-- =====================================================
-- Quotation Items (Dosya Bazlı Teklif) Sistemi
-- =====================================================

-- 1. quotations ana tablosunu oluştur (eğer yoksa)
CREATE TABLE IF NOT EXISTS public.quotations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    total_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    delivery_date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, supplier_id)
);

-- Index for quotations
CREATE INDEX IF NOT EXISTS idx_quotations_project ON public.quotations(project_id);
CREATE INDEX IF NOT EXISTS idx_quotations_supplier ON public.quotations(supplier_id);

-- RLS for quotations
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

-- Supplier can manage their own quotations
CREATE POLICY "Suppliers can manage their quotations"
ON public.quotations FOR ALL
TO authenticated
USING (supplier_id = auth.uid());

-- Customer can view quotations for their projects
CREATE POLICY "Customers can view quotations for their projects"
ON public.quotations FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = quotations.project_id
        AND p.created_by = auth.uid()
    )
);

-- Admin can view all quotations
CREATE POLICY "Admins can view all quotations"
ON public.quotations FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 2. quotation_items tablosu oluştur
CREATE TABLE IF NOT EXISTS public.quotation_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
    file_id UUID REFERENCES public.project_files(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('file', 'extra')),
    title TEXT, -- Ekstra kalemler için başlık
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON public.quotation_items(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_file ON public.quotation_items(file_id);

-- 3. RLS Policies
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

-- Supplier can create/read/update their own quotation items
CREATE POLICY "Suppliers can manage their quotation items"
ON public.quotation_items FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.quotations q
        WHERE q.id = quotation_items.quotation_id
        AND q.supplier_id = auth.uid()
    )
);

-- Customer can read quotation items for their projects
CREATE POLICY "Customers can view quotation items for their projects"
ON public.quotation_items FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.quotations q
        JOIN public.projects p ON p.id = q.project_id
        WHERE q.id = quotation_items.quotation_id
        AND p.created_by = auth.uid()
    )
);

-- Admin can read all quotation items
CREATE POLICY "Admins can view all quotation items"
ON public.quotation_items FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 4. Function: Calculate total price from items
CREATE OR REPLACE FUNCTION calculate_quotation_total(p_quotation_id UUID)
RETURNS DECIMAL(10, 2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total DECIMAL(10, 2);
BEGIN
    SELECT COALESCE(SUM(price * quantity), 0)
    INTO v_total
    FROM public.quotation_items
    WHERE quotation_id = p_quotation_id;
    
    RETURN v_total;
END;
$$;

-- 5. Trigger: Update quotation total_price when items change
CREATE OR REPLACE FUNCTION update_quotation_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.quotations
    SET total_price = calculate_quotation_total(
        CASE 
            WHEN TG_OP = 'DELETE' THEN OLD.quotation_id
            ELSE NEW.quotation_id
        END
    )
    WHERE id = CASE 
        WHEN TG_OP = 'DELETE' THEN OLD.quotation_id
        ELSE NEW.quotation_id
    END;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_quotation_total ON public.quotation_items;
CREATE TRIGGER trigger_update_quotation_total
AFTER INSERT OR UPDATE OR DELETE ON public.quotation_items
FOR EACH ROW
EXECUTE FUNCTION update_quotation_total();

-- 6. Migrate existing quotations (if any have prices)
-- This will create a single 'extra' item for existing quotations
INSERT INTO public.quotation_items (quotation_id, item_type, title, price, quantity)
SELECT 
    id,
    'extra',
    'Toplam Teklif',
    total_price,
    1
FROM public.quotations
WHERE total_price > 0
ON CONFLICT DO NOTHING;
