-- =====================================================
-- Hiyerarşik Checklist Sistemi Migration
-- =====================================================

-- 1. checklist_items tablosuna parent_id ve file_id ekle
ALTER TABLE public.checklist_items 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.checklist_items(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS file_id UUID REFERENCES public.project_files(id) ON DELETE CASCADE;

-- 2. STEP dosyaları için varsayılan checklist template'leri
CREATE TABLE IF NOT EXISTS public.step_checklist_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for step_checklist_templates
ALTER TABLE public.step_checklist_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read step checklist templates"
ON public.step_checklist_templates FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Admins can manage step checklist templates"
ON public.step_checklist_templates FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 3. STEP dosyası için varsayılan 5 checklist ekle
INSERT INTO public.step_checklist_templates (name, description, order_index) VALUES
('Geometri Kontrolü', '3D model geometrisinin doğruluğunu kontrol et', 1),
('Ölçü Doğrulama', 'Modeldeki ölçülerin çizime uygunluğunu kontrol et', 2),
('Yüzey Kalitesi', 'Yüzey pürüzlülüğü ve işlem kalitesini kontrol et', 3),
('Tolerans Uyumu', 'Tolerans değerlerinin sağlandığını doğrula', 4),
('Malzeme Uygunluğu', 'Kullanılan malzemenin spesifikasyona uygunluğu', 5)
ON CONFLICT DO NOTHING;

-- 4. Index'ler (performans için)
CREATE INDEX IF NOT EXISTS idx_checklist_items_parent_id ON public.checklist_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_file_id ON public.checklist_items(file_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_project_file ON public.checklist_items(project_id, file_id);

