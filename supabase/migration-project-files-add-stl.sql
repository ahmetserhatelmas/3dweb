-- Add 'stl' to project_files file_type allowed values (so STL uploads are saved)
ALTER TABLE public.project_files DROP CONSTRAINT IF EXISTS project_files_file_type_check;

ALTER TABLE public.project_files ADD CONSTRAINT project_files_file_type_check
  CHECK (file_type IN ('step', 'stl', 'dxf', 'iges', 'parasolid', 'pdf', 'excel', 'image', 'document', 'other'));
