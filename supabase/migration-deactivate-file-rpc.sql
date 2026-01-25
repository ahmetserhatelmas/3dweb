-- RPC function to deactivate a project file (bypasses RLS)
CREATE OR REPLACE FUNCTION deactivate_project_file(
  p_file_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER  -- Run with function owner's privileges, bypassing RLS
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE public.project_files
  SET 
    is_active = false,
    status = 'inactive'
  WHERE id = p_file_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  IF v_updated_count = 0 THEN
    RAISE EXCEPTION 'File not found or could not be updated. File ID: %', p_file_id;
  END IF;
  
  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION deactivate_project_file IS 'Deactivates a project file by setting is_active=false and status=inactive, bypassing RLS';

