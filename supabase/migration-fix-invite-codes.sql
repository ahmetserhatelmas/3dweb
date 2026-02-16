-- Fix Missing Invite Codes and Trigger

-- Step 1: Create the function to generate invite codes
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate for customers if invite_code is NULL
  IF NEW.user_type = 'customer' AND NEW.invite_code IS NULL THEN
    NEW.invite_code := CONCAT('INV-', UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT), 1, 12)));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Drop and recreate trigger
DROP TRIGGER IF EXISTS generate_invite_code_trigger ON profiles;
CREATE TRIGGER generate_invite_code_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION generate_invite_code();

-- Step 3: Generate invite codes for existing customers without one
UPDATE profiles
SET invite_code = CONCAT('INV-', UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT), 1, 12)))
WHERE user_type = 'customer' AND invite_code IS NULL;

-- Step 4: Verify
SELECT 
  id,
  username,
  user_type,
  invite_code,
  created_at
FROM profiles
WHERE user_type = 'customer'
ORDER BY created_at DESC;

-- Success message
SELECT 
  COUNT(*) FILTER (WHERE invite_code IS NOT NULL) as customers_with_invite,
  COUNT(*) FILTER (WHERE invite_code IS NULL) as customers_without_invite
FROM profiles
WHERE user_type = 'customer';
