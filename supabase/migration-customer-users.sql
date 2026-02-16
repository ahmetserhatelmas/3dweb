-- Customer Users System Migration
-- This migration adds support for customer accounts to have multiple users

-- 1. Add user_invite_code to profiles table (for inviting users to customer account)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS user_invite_code TEXT UNIQUE;

-- 2. Add is_customer_admin flag to profiles (to distinguish main customer admin from users)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_customer_admin BOOLEAN DEFAULT false;

-- 3. Add customer_id to profiles (for customer users to link to their parent customer)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- 4. Create customer_users table (tracks which users belong to which customer)
CREATE TABLE IF NOT EXISTS customer_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, user_id)
);

-- 5. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_customer_users_customer ON customer_users(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_users_user ON customer_users(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_invite_code ON profiles(user_invite_code);
CREATE INDEX IF NOT EXISTS idx_profiles_customer_id ON profiles(customer_id);

-- 6. Enable RLS
ALTER TABLE customer_users ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for customer_users
DROP POLICY IF EXISTS "Users can view their customer relationships" ON customer_users;
CREATE POLICY "Users can view their customer relationships"
  ON customer_users FOR SELECT
  USING (
    auth.uid() = customer_id OR 
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Customer admins can manage their users" ON customer_users;
CREATE POLICY "Customer admins can manage their users"
  ON customer_users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR (role = 'customer' AND is_customer_admin = true AND id = customer_id))
    )
  );

-- 8. Function to generate unique user invite code for customers
CREATE OR REPLACE FUNCTION generate_user_invite_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 8 character code (USER-XXXX format)
    new_code := 'USER-' || UPPER(substr(md5(random()::text), 1, 4));
    
    -- Check if code exists
    SELECT EXISTS(SELECT 1 FROM profiles WHERE user_invite_code = new_code) INTO code_exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- 9. Function to accept user invite (customer user joins customer account)
CREATE OR REPLACE FUNCTION accept_user_invite(
  p_invite_code TEXT
)
RETURNS JSON AS $$
DECLARE
  v_customer_id UUID;
  v_user_id UUID;
  v_customer_name TEXT;
  v_customer_company TEXT;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Kullanıcı oturumu bulunamadı');
  END IF;
  
  -- Find customer by user invite code
  SELECT id, username, company_name
  INTO v_customer_id, v_customer_name, v_customer_company
  FROM profiles
  WHERE user_invite_code = p_invite_code
    AND role = 'customer'
    AND is_customer_admin = true;
  
  IF v_customer_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Geçersiz davet kodu');
  END IF;
  
  -- Check if user is already connected to this customer
  IF EXISTS (
    SELECT 1 FROM customer_users 
    WHERE customer_id = v_customer_id 
      AND user_id = v_user_id 
      AND status = 'active'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Bu müşteri hesabına zaten bağlısınız');
  END IF;
  
  -- Insert or update customer_users relationship
  INSERT INTO customer_users (customer_id, user_id, status)
  VALUES (v_customer_id, v_user_id, 'active')
  ON CONFLICT (customer_id, user_id) 
  DO UPDATE SET status = 'active', joined_at = NOW();
  
  -- Update user's customer_id in profiles
  UPDATE profiles
  SET customer_id = v_customer_id
  WHERE id = v_user_id;
  
  RETURN json_build_object(
    'success', true,
    'customer', json_build_object(
      'id', v_customer_id,
      'username', v_customer_name,
      'company_name', v_customer_company
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Update existing customer accounts to set is_customer_admin = true
UPDATE profiles
SET is_customer_admin = true
WHERE role = 'customer' AND user_type = 'customer';

-- 11. Generate user invite codes for existing customers
UPDATE profiles
SET user_invite_code = generate_user_invite_code()
WHERE role = 'customer' 
  AND is_customer_admin = true 
  AND user_invite_code IS NULL;

COMMENT ON TABLE customer_users IS 'Links customer users to customer accounts';
COMMENT ON COLUMN profiles.user_invite_code IS 'Invite code for users to join customer account';
COMMENT ON COLUMN profiles.is_customer_admin IS 'True if this is the main customer admin account';
COMMENT ON COLUMN profiles.customer_id IS 'Parent customer ID for customer users';
