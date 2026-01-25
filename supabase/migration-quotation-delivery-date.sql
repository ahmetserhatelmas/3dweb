-- =============================================
-- TEKLİF SİSTEMİNE TERMİN TARİHİ EKLENMESİ
-- =============================================

-- 1. project_suppliers tablosuna tedarikçi teklif termin tarihi ekle
ALTER TABLE public.project_suppliers 
ADD COLUMN IF NOT EXISTS delivery_date DATE;

COMMENT ON COLUMN public.project_suppliers.delivery_date IS 'Tedarikçinin teklif ettiği teslim tarihi';

