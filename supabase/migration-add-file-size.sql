-- Add file_size column to project_files table
-- This column will store file sizes in bytes for storage tracking

-- Add file_size column (bigint to support large files)
ALTER TABLE project_files
ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;

-- Add comment to explain the column
COMMENT ON COLUMN project_files.file_size IS 'File size in bytes';

-- Create index for efficient storage calculations
CREATE INDEX IF NOT EXISTS idx_project_files_file_size 
ON project_files(file_size) 
WHERE is_active = true;
