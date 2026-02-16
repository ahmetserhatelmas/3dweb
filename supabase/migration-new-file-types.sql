-- Migration: Add new CAD file types (DXF, IGES, Parasolid)
-- Run this in Supabase SQL Editor

-- Drop existing check constraint
ALTER TABLE project_files DROP CONSTRAINT IF EXISTS project_files_file_type_check;

-- Add new check constraint with additional file types
ALTER TABLE project_files ADD CONSTRAINT project_files_file_type_check 
  CHECK (file_type IN ('step', 'dxf', 'iges', 'parasolid', 'pdf', 'excel', 'image', 'document', 'other'));

-- Verify the constraint was updated
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'project_files'::regclass AND contype = 'c';
