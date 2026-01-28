-- =============================================
-- MÜŞTERİ TEKLİF NOTLARI MİGRASYONU
-- =============================================

-- 1. project_suppliers tablosuna müşteri notu alanı ekle
ALTER TABLE public.project_suppliers 
ADD COLUMN IF NOT EXISTS customer_note TEXT,
ADD COLUMN IF NOT EXISTS customer_note_at TIMESTAMP WITH TIME ZONE;

-- 2. Müşterilerin kendi projelerindeki tekliflere not ekleyebilmesi için policy
DROP POLICY IF EXISTS "Customers can add notes to quotations" ON public.project_suppliers;
CREATE POLICY "Customers can add notes to quotations" ON public.project_suppliers
FOR UPDATE USING (
  project_id IN (
    SELECT id FROM public.projects WHERE created_by = auth.uid()
  )
)
WITH CHECK (
  project_id IN (
    SELECT id FROM public.projects WHERE created_by = auth.uid()
  )
);

-- 3. Tedarikçiler müşteri notlarını görebilir
-- (Zaten mevcut "Suppliers can view their quotations" policy bunu kapsar)

COMMENT ON COLUMN public.project_suppliers.customer_note IS 'Müşterinin tedarikçiye bıraktığı not (örn: fiyat güncelleme talebi)';
COMMENT ON COLUMN public.project_suppliers.customer_note_at IS 'Müşteri notunun eklendiği zaman';
