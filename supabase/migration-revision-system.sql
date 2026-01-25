-- =============================================
-- REVİZYON SİSTEMİ MİGRASYONU
-- =============================================

-- 1. project_files tablosuna revizyon bilgileri ekle
ALTER TABLE public.project_files 
ADD COLUMN IF NOT EXISTS revision VARCHAR(10) DEFAULT 'A',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS parent_file_id UUID REFERENCES public.project_files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_files_active ON public.project_files(project_id, is_active);
CREATE INDEX IF NOT EXISTS idx_project_files_revision ON public.project_files(project_id, file_name, revision);

-- 2. Revizyon İstekleri Tablosu
CREATE TABLE IF NOT EXISTS public.revision_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_id UUID NOT NULL REFERENCES public.project_files(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    
    -- Revizyon tipi
    revision_type TEXT NOT NULL CHECK (revision_type IN ('geometry', 'quantity')),
    
    -- Eski ve yeni revizyon
    from_revision VARCHAR(10) NOT NULL,
    to_revision VARCHAR(10) NOT NULL,
    
    -- Değişiklik bilgileri
    old_quantity INTEGER,
    new_quantity INTEGER,
    new_file_url TEXT, -- Geometri revizyonu için yeni dosya
    new_file_path TEXT,
    
    -- Durum
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    
    -- Açıklama
    description TEXT,
    rejection_reason TEXT,
    
    -- Etkileme seviyesi (sadece adet revizyonu için)
    affect_scope TEXT CHECK (affect_scope IN ('file_only', 'project_wide')),
    
    -- Kim tarafından
    requested_by UUID NOT NULL REFERENCES public.profiles(id),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Tedarikçi yanıtı
    responded_by UUID REFERENCES public.profiles(id),
    responded_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revision_requests_file ON public.revision_requests(file_id);
CREATE INDEX IF NOT EXISTS idx_revision_requests_project ON public.revision_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_revision_requests_status ON public.revision_requests(status);

-- 3. Revizyon Geçmişi Tablosu (tüm değişiklikler kaydedilir)
CREATE TABLE IF NOT EXISTS public.revision_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_id UUID NOT NULL REFERENCES public.project_files(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    revision_request_id UUID REFERENCES public.revision_requests(id),
    
    -- Revizyon bilgisi
    revision VARCHAR(10) NOT NULL,
    revision_type TEXT NOT NULL CHECK (revision_type IN ('geometry', 'quantity')),
    
    -- Değişiklik detayları
    change_summary TEXT,
    old_value JSONB, -- Eski değerler (quantity, file_url, vb)
    new_value JSONB, -- Yeni değerler
    
    -- Kim, ne zaman
    changed_by UUID NOT NULL REFERENCES public.profiles(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Checklist sıfırlandı mı?
    checklist_reset BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revision_history_file ON public.revision_history(file_id);
CREATE INDEX IF NOT EXISTS idx_revision_history_project ON public.revision_history(project_id);

-- 4. Proje seviyesi aktif revizyon tracking
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS current_revision VARCHAR(10) DEFAULT 'A';

-- 5. Helper function: Next revision letter
CREATE OR REPLACE FUNCTION next_revision(current_rev VARCHAR(10))
RETURNS VARCHAR(10) AS $$
DECLARE
    letter CHAR(1);
    next_letter CHAR(1);
BEGIN
    -- Sadece tek harf revizyonları destekle (A-Z)
    letter := UPPER(SUBSTRING(current_rev FROM 1 FOR 1));
    
    IF letter = 'Z' THEN
        -- Z'den sonra AA'ya geç (opsiyonel)
        RETURN 'AA';
    ELSE
        -- Bir sonraki harf
        next_letter := CHR(ASCII(letter) + 1);
        RETURN next_letter;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. RLS Policies for revision_requests
ALTER TABLE public.revision_requests ENABLE ROW LEVEL SECURITY;

-- Müşteriler kendi projelerinin revizyon isteklerini görebilir ve oluşturabilir
CREATE POLICY "Customers can manage revision requests"
ON public.revision_requests FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_id 
        AND p.created_by = auth.uid()
    )
);

-- Tedarikçiler atandıkları projelerin revizyon isteklerini görebilir ve yanıtlayabilir
CREATE POLICY "Suppliers can view and respond to revision requests"
ON public.revision_requests FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_id 
        AND p.assigned_to = auth.uid()
    )
);

-- Adminler her şeyi görebilir
CREATE POLICY "Admins full access to revision requests"
ON public.revision_requests FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 7. RLS Policies for revision_history
ALTER TABLE public.revision_history ENABLE ROW LEVEL SECURITY;

-- Müşteriler kendi projelerinin geçmişini görebilir
CREATE POLICY "Customers can view revision history"
ON public.revision_history FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_id 
        AND p.created_by = auth.uid()
    )
);

-- Tedarikçiler atandıkları projelerin geçmişini görebilir
CREATE POLICY "Suppliers can view revision history"
ON public.revision_history FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_id 
        AND p.assigned_to = auth.uid()
    )
);

-- Adminler her şeyi görebilir
CREATE POLICY "Admins can view all revision history"
ON public.revision_history FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 8. Trigger: revision_requests updated_at
CREATE TRIGGER update_revision_requests_updated_at
    BEFORE UPDATE ON public.revision_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 9. Comments
COMMENT ON TABLE public.revision_requests IS 'Revizyon talepleri - geometri veya adet değişiklikleri';
COMMENT ON TABLE public.revision_history IS 'Tüm revizyon değişikliklerinin geçmişi';
COMMENT ON COLUMN public.project_files.revision IS 'Dosya revizyon harfi (A, B, C, ...)';
COMMENT ON COLUMN public.project_files.is_active IS 'Aktif revizyon mu? (sadece bir revizyon aktif olabilir)';
COMMENT ON COLUMN public.project_files.parent_file_id IS 'Bir önceki revizyon dosyası (revizyon zinciri için)';
COMMENT ON COLUMN public.revision_requests.revision_type IS 'geometry: STEP dosyası değişti, quantity: sadece adet değişti';
COMMENT ON COLUMN public.revision_requests.affect_scope IS 'file_only: sadece bu dosya, project_wide: tüm proje etkilenir';

-- 10. Mevcut dosyaları Rev. A olarak işaretle
UPDATE public.project_files 
SET revision = 'A', is_active = true 
WHERE revision IS NULL;

