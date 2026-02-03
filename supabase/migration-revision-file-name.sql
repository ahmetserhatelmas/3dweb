-- Add new_file_name column to revision_requests table
ALTER TABLE revision_requests 
ADD COLUMN IF NOT EXISTS new_file_name TEXT;

-- Comment
COMMENT ON COLUMN revision_requests.new_file_name IS 'Original name of the new file uploaded for geometry revision';
