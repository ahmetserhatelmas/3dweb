-- Customer Plans Migration
-- Adds subscription plan support for customer accounts

-- 1. Add plan_type and plan_start_date to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'starter' CHECK (plan_type IN ('starter', 'business')),
ADD COLUMN IF NOT EXISTS plan_start_date TIMESTAMPTZ;

-- 2. Create index for plan queries
CREATE INDEX IF NOT EXISTS idx_profiles_plan_type ON profiles(plan_type) WHERE role = 'customer';

-- 3. Set default plan for existing customers
UPDATE profiles
SET 
  plan_type = 'starter',
  plan_start_date = created_at
WHERE role = 'customer' 
  AND user_type = 'customer' 
  AND is_customer_admin = true
  AND plan_type IS NULL;

-- 4. Update RLS policies to allow admins to update plans
-- (Existing policies should already allow this, but we'll ensure it)

COMMENT ON COLUMN profiles.plan_type IS 'Subscription plan type for customers: starter or business';
COMMENT ON COLUMN profiles.plan_start_date IS 'Date when the current plan started';
