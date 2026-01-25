-- Add quotation fields to revision_requests
ALTER TABLE public.revision_requests
ADD COLUMN IF NOT EXISTS supplier_quoted_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS supplier_quoted_deadline DATE,
ADD COLUMN IF NOT EXISTS supplier_quoted_note TEXT,
ADD COLUMN IF NOT EXISTS supplier_quoted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.revision_requests.supplier_quoted_price IS 'Tedarikçinin revizyon için teklif ettiği fiyat';
COMMENT ON COLUMN public.revision_requests.supplier_quoted_deadline IS 'Tedarikçinin revizyon için teklif ettiği termin';
COMMENT ON COLUMN public.revision_requests.supplier_quoted_note IS 'Tedarikçinin revizyon teklifi notu';
COMMENT ON COLUMN public.revision_requests.supplier_quoted_at IS 'Tedarikçinin teklif verme zamanı';

-- Drop old status constraint and create new one with awaiting_customer_approval
ALTER TABLE public.revision_requests
DROP CONSTRAINT IF EXISTS revision_requests_status_check;

ALTER TABLE public.revision_requests
ADD CONSTRAINT revision_requests_status_check 
CHECK (status IN ('pending', 'awaiting_customer_approval', 'accepted', 'rejected', 'cancelled'));

-- Update RPC function to update project price and deadline
CREATE OR REPLACE FUNCTION update_project_price_and_deadline(
  p_project_id UUID,
  p_quoted_price DECIMAL,
  p_deadline DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update project deadline
  UPDATE public.projects
  SET deadline = p_deadline
  WHERE id = p_project_id;
  
  -- Update project_suppliers quoted_price for accepted supplier
  UPDATE public.project_suppliers
  SET quoted_price = p_quoted_price
  WHERE project_id = p_project_id
    AND status = 'accepted';
END;
$$;

