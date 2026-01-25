-- Add 'both' to revision_type constraint
ALTER TABLE public.revision_requests
DROP CONSTRAINT IF EXISTS revision_requests_revision_type_check;

ALTER TABLE public.revision_requests
ADD CONSTRAINT revision_requests_revision_type_check 
CHECK (revision_type IN ('geometry', 'quantity', 'both'));

-- Also update revision_history table if it has the same constraint
ALTER TABLE public.revision_history
DROP CONSTRAINT IF EXISTS revision_history_revision_type_check;

ALTER TABLE public.revision_history
ADD CONSTRAINT revision_history_revision_type_check 
CHECK (revision_type IN ('geometry', 'quantity', 'both'));

