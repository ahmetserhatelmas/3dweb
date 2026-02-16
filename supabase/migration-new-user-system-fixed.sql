-- Migration: New User System with Separate Supplier and Customer Accounts
-- Run this in Supabase SQL Editor

-- Step 1: Add user_type column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT 'supplier';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invite_code VARCHAR(50) UNIQUE;

-- Step 2: Update existing profiles
-- Set existing profiles based on their role
UPDATE profiles SET user_type = 'supplier' WHERE role = 'user';
UPDATE profiles SET user_type = 'customer' WHERE role = 'customer';
UPDATE profiles SET user_type = 'admin' WHERE role = 'admin';

-- Step 3: Add constraint for user_type
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_type_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_user_type_check 
  CHECK (user_type IN ('supplier', 'customer', 'admin'));

-- Step 4: Generate unique invite codes for existing customers
UPDATE profiles 
SET invite_code = CONCAT('INV-', UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 12)))
WHERE user_type = 'customer' AND invite_code IS NULL;

-- Step 5: Create supplier_customer_relationships table
CREATE TABLE IF NOT EXISTS supplier_customer_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'active', -- active, blocked
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id, customer_id)
);

-- Step 6: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_supplier_customer_supplier ON supplier_customer_relationships(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_customer_customer ON supplier_customer_relationships(customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_invite_code ON profiles(invite_code);
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);

-- Step 7: Enable RLS on supplier_customer_relationships
ALTER TABLE supplier_customer_relationships ENABLE ROW LEVEL SECURITY;

-- Step 8: RLS Policies for supplier_customer_relationships
-- Drop existing policies if any
DROP POLICY IF EXISTS "Suppliers can view their customers" ON supplier_customer_relationships;
DROP POLICY IF EXISTS "Customers can view their suppliers" ON supplier_customer_relationships;
DROP POLICY IF EXISTS "Suppliers can create relationships" ON supplier_customer_relationships;
DROP POLICY IF EXISTS "Users can update their relationships" ON supplier_customer_relationships;

-- Suppliers can see their customers
CREATE POLICY "Suppliers can view their customers" ON supplier_customer_relationships
  FOR SELECT USING (
    auth.uid() = supplier_id OR
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );

-- Customers can see their suppliers
CREATE POLICY "Customers can view their suppliers" ON supplier_customer_relationships
  FOR SELECT USING (
    auth.uid() = customer_id OR
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );

-- Suppliers can create relationships when accepting invites
CREATE POLICY "Suppliers can create relationships" ON supplier_customer_relationships
  FOR INSERT WITH CHECK (auth.uid() = supplier_id);

-- Both parties can update relationship status
CREATE POLICY "Users can update their relationships" ON supplier_customer_relationships
  FOR UPDATE USING (
    auth.uid() = supplier_id OR 
    auth.uid() = customer_id OR
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );

-- Step 9: Update existing customer-supplier relationships from created_by
INSERT INTO supplier_customer_relationships (supplier_id, customer_id, status, created_at)
SELECT DISTINCT p.id as supplier_id, p.created_by as customer_id, 'active', p.created_at
FROM profiles p
WHERE p.role = 'user' AND p.created_by IS NOT NULL AND p.user_type = 'supplier'
ON CONFLICT (supplier_id, customer_id) DO NOTHING;

-- Step 10: Function to generate invite code for new customers
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_type = 'customer' AND NEW.invite_code IS NULL THEN
    NEW.invite_code := CONCAT('INV-', UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 12)));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 11: Trigger to auto-generate invite code
DROP TRIGGER IF EXISTS generate_invite_code_trigger ON profiles;
CREATE TRIGGER generate_invite_code_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION generate_invite_code();

-- Step 12: Function to accept supplier invite
CREATE OR REPLACE FUNCTION accept_supplier_invite(p_invite_code TEXT)
RETURNS JSON AS $$
DECLARE
  v_customer_id UUID;
  v_supplier_id UUID;
  v_result JSON;
BEGIN
  -- Get supplier ID (caller)
  v_supplier_id := auth.uid();
  
  -- Check if caller is a supplier
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_supplier_id AND user_type = 'supplier') THEN
    RETURN json_build_object('success', false, 'error', 'Only suppliers can accept invites');
  END IF;
  
  -- Find customer by invite code
  SELECT id INTO v_customer_id
  FROM profiles
  WHERE invite_code = p_invite_code AND user_type = 'customer';
  
  IF v_customer_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid invite code');
  END IF;
  
  -- Check if relationship already exists
  IF EXISTS (
    SELECT 1 FROM supplier_customer_relationships
    WHERE supplier_id = v_supplier_id AND customer_id = v_customer_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Relationship already exists');
  END IF;
  
  -- Create relationship
  INSERT INTO supplier_customer_relationships (supplier_id, customer_id, status)
  VALUES (v_supplier_id, v_customer_id, 'active');
  
  -- Return success with customer info
  SELECT json_build_object(
    'success', true,
    'customer', json_build_object(
      'id', id,
      'username', username,
      'company_name', company_name
    )
  ) INTO v_result
  FROM profiles
  WHERE id = v_customer_id;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 13: Create view for easy customer-supplier queries
DROP VIEW IF EXISTS customer_suppliers;
CREATE OR REPLACE VIEW customer_suppliers AS
SELECT 
  scr.id as relationship_id,
  scr.customer_id,
  scr.supplier_id,
  scr.status,
  scr.created_at,
  c.username as customer_username,
  c.company_name as customer_company,
  s.username as supplier_username,
  s.company_name as supplier_company
FROM supplier_customer_relationships scr
JOIN profiles c ON scr.customer_id = c.id
JOIN profiles s ON scr.supplier_id = s.id;

-- Grant access to authenticated users
GRANT SELECT ON customer_suppliers TO authenticated;

-- Step 14: Allow profiles with same email but different auth.users
-- This is handled at the auth level, not in profiles table

-- Verification queries
SELECT 'Migration completed successfully!' as message;
SELECT COUNT(*) as total_profiles, user_type FROM profiles GROUP BY user_type;
SELECT COUNT(*) as total_relationships FROM supplier_customer_relationships;
