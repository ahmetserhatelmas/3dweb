-- Ensure all customer accounts have a plan (default: starter)
-- Run this if you have existing customers with plan_type NULL

UPDATE profiles
SET 
  plan_type = 'starter',
  plan_start_date = COALESCE(plan_start_date, created_at)
WHERE role = 'customer'
  AND (plan_type IS NULL OR plan_type NOT IN ('starter', 'business'));
