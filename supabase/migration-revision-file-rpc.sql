-- RPC function to create revision file (bypasses RLS)
CREATE OR REPLACE FUNCTION create_revision_file(
  p_project_id UUID,
  p_file_name TEXT,
  p_file_type TEXT,
  p_quantity INTEGER,
  p_revision VARCHAR(10),
  p_file_url TEXT,
  p_file_path TEXT,
  p_parent_file_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER  -- Run with function owner's privileges, bypassing RLS
AS $$
DECLARE
  v_new_file_id UUID;
BEGIN
  INSERT INTO public.project_files (
    project_id,
    file_name,
    file_type,
    quantity,
    revision,
    file_url,
    file_path,
    parent_file_id,
    is_active
  ) VALUES (
    p_project_id,
    p_file_name,
    p_file_type,
    p_quantity,
    p_revision,
    p_file_url,
    p_file_path,
    p_parent_file_id,
    true
  )
  RETURNING id INTO v_new_file_id;
  
  RETURN v_new_file_id;
END;
$$;

COMMENT ON FUNCTION create_revision_file IS 'Creates a new revision file entry, bypassing RLS for geometry revisions';

