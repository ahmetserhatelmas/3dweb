-- RPC function to submit quotation (bypasses RLS)
CREATE OR REPLACE FUNCTION submit_quotation(
  p_project_supplier_id UUID,
  p_quoted_price DECIMAL,
  p_quoted_note TEXT,
  p_delivery_date DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER  -- Run with function owner's privileges, bypassing RLS
AS $$
BEGIN
  UPDATE public.project_suppliers
  SET 
    status = 'quoted',
    quoted_price = p_quoted_price,
    quoted_note = p_quoted_note,
    quoted_at = NOW(),
    delivery_date = p_delivery_date
  WHERE id = p_project_supplier_id;
  
  RETURN p_project_supplier_id;
END;
$$;

COMMENT ON FUNCTION submit_quotation IS 'Submits a supplier quotation, bypassing RLS for updates';

