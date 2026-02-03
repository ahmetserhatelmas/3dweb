-- RPC function to update quotation item price (bypasses RLS)
CREATE OR REPLACE FUNCTION update_quotation_item_price(
  p_item_id UUID,
  p_price NUMERIC,
  p_quantity INTEGER,
  p_file_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_file_id IS NOT NULL THEN
    UPDATE quotation_items 
    SET price = p_price, quantity = p_quantity, file_id = p_file_id
    WHERE id = p_item_id;
  ELSE
    UPDATE quotation_items 
    SET price = p_price, quantity = p_quantity
    WHERE id = p_item_id;
  END IF;
  
  RETURN FOUND;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_quotation_item_price TO authenticated;
GRANT EXECUTE ON FUNCTION update_quotation_item_price TO service_role;

-- Check if quotation_items has RLS enabled and add policy if needed
DO $$
BEGIN
  -- Make sure service_role can update quotation_items
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'quotation_items' 
    AND policyname = 'service_role_full_access'
  ) THEN
    CREATE POLICY service_role_full_access ON quotation_items
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;
