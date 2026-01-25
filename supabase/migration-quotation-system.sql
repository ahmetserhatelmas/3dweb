-- =============================================
-- TEKLİF SİSTEMİ MİGRASYONU
-- =============================================

-- 1. project_suppliers tablosuna teklif alanları ekle
ALTER TABLE public.project_suppliers 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'quoted', 'accepted', 'rejected')),
ADD COLUMN IF NOT EXISTS quoted_price DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS quoted_note TEXT,
ADD COLUMN IF NOT EXISTS quoted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP WITH TIME ZONE;

-- 2. projects tablosuna is_quotation flag ekle
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS is_quotation BOOLEAN DEFAULT true;

-- 3. Mevcut projeleri güncelle (eski projeler direkt atanmış sayılsın)
UPDATE public.projects SET is_quotation = false WHERE status != 'pending';

-- 4. Mevcut project_suppliers kayıtlarını 'accepted' yap (eski projeler için)
UPDATE public.project_suppliers SET status = 'accepted' 
WHERE project_id IN (SELECT id FROM public.projects WHERE is_quotation = false);

-- 5. RLS Policies güncelle
-- Tedarikçiler kendi teklif durumlarını güncelleyebilir
DROP POLICY IF EXISTS "Suppliers can update their quotations" ON public.project_suppliers;
CREATE POLICY "Suppliers can update their quotations" ON public.project_suppliers
FOR UPDATE USING (supplier_id = auth.uid())
WITH CHECK (supplier_id = auth.uid());

-- Tedarikçiler kendi tekliflerini görebilir
DROP POLICY IF EXISTS "Suppliers can view their quotations" ON public.project_suppliers;
CREATE POLICY "Suppliers can view their quotations" ON public.project_suppliers
FOR SELECT USING (supplier_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.created_by = auth.uid()));

-- Müşteriler kendi projelerinin tekliflerini görebilir
DROP POLICY IF EXISTS "Customers can view project quotations" ON public.project_suppliers;
CREATE POLICY "Customers can view project quotations" ON public.project_suppliers
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.created_by = auth.uid())
);

-- Müşteriler teklifleri kabul/red edebilir
DROP POLICY IF EXISTS "Customers can update quotation status" ON public.project_suppliers;
CREATE POLICY "Customers can update quotation status" ON public.project_suppliers
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.created_by = auth.uid())
);

COMMENT ON COLUMN public.project_suppliers.status IS 'pending: teklif bekliyor, quoted: teklif verildi, accepted: kabul edildi, rejected: reddedildi';

