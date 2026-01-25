-- =====================================================
-- Multi-File Project System Migration
-- =====================================================

-- 1. Projects tablosuna deadline ekle
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS deadline DATE;

-- 2. Project Files tablosu (projeye ait dosyalar)
CREATE TABLE IF NOT EXISTS public.project_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('step', 'pdf', 'excel', 'image', 'other')),
    file_url TEXT NOT NULL,
    file_path TEXT, -- Storage path
    description TEXT,
    quantity INTEGER DEFAULT 1, -- STEP dosyaları için adet
    notes TEXT, -- Müşteri notu
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Project Suppliers tablosu (çoklu tedarikçi ataması)
CREATE TABLE IF NOT EXISTS public.project_suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, supplier_id)
);

-- 4. Standart Checklist Template tablosu
CREATE TABLE IF NOT EXISTS public.checklist_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Checklist items tablosuna supplier_notes ekle
ALTER TABLE public.checklist_items 
ADD COLUMN IF NOT EXISTS supplier_notes TEXT;

-- 6. Eski assigned_to kolonunu kaldırmak yerine nullable yap (geriye uyumluluk)
-- projects.assigned_to artık kullanılmayacak, project_suppliers kullanılacak

-- =====================================================
-- RLS Policies
-- =====================================================

-- Project Files RLS
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins full access to project_files"
ON public.project_files FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Customers can manage files for their projects
CREATE POLICY "Customers can manage their project files"
ON public.project_files FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.profiles pr ON pr.id = auth.uid()
        WHERE p.id = project_files.project_id 
        AND p.created_by = auth.uid()
        AND pr.role = 'customer'
    )
);

-- Suppliers can view files for assigned projects
CREATE POLICY "Suppliers can view assigned project files"
ON public.project_files FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.project_suppliers ps
        JOIN public.profiles pr ON pr.id = auth.uid()
        WHERE ps.project_id = project_files.project_id 
        AND ps.supplier_id = auth.uid()
        AND pr.role = 'user'
    )
);

-- Project Suppliers RLS
ALTER TABLE public.project_suppliers ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins full access to project_suppliers"
ON public.project_suppliers FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Customers can manage suppliers for their projects
CREATE POLICY "Customers can manage their project suppliers"
ON public.project_suppliers FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.profiles pr ON pr.id = auth.uid()
        WHERE p.id = project_suppliers.project_id 
        AND p.created_by = auth.uid()
        AND pr.role = 'customer'
    )
);

-- Suppliers can view their assignments
CREATE POLICY "Suppliers can view their assignments"
ON public.project_suppliers FOR SELECT
TO authenticated
USING (supplier_id = auth.uid());

-- Checklist Templates RLS
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;

-- Everyone can read templates
CREATE POLICY "Everyone can read checklist templates"
ON public.checklist_templates FOR SELECT
TO authenticated
USING (is_active = true);

-- Only admins can manage templates
CREATE POLICY "Admins can manage checklist templates"
ON public.checklist_templates FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- =====================================================
-- Standart Checklist Template'leri Ekle
-- =====================================================

INSERT INTO public.checklist_templates (name, description, order_index) VALUES
('Teknik Çizim Kontrolü', 'Teknik çizimlerin doğruluğunu kontrol et', 1),
('Boyut Kontrolü', 'Ölçülerin spesifikasyonlara uygunluğunu doğrula', 2),
('Malzeme Kontrolü', 'Kullanılan malzemenin uygunluğunu kontrol et', 3),
('Yüzey İşlem Kontrolü', 'Yüzey kalitesi ve işlem kontrolü', 4),
('Tolerans Kontrolü', 'Tolerans değerlerinin uygunluğunu kontrol et', 5),
('Montaj Uygunluğu', 'Parçaların montaja uygunluğunu kontrol et', 6),
('Kalite Belgesi', 'Kalite belgelerinin hazırlanması', 7),
('Paketleme Kontrolü', 'Ürünlerin uygun şekilde paketlenmesi', 8)
ON CONFLICT DO NOTHING;

-- =====================================================
-- Storage Bucket for Project Files
-- =====================================================

-- project-files bucket oluştur (Supabase Dashboard'dan veya API ile)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('project-files', 'project-files', false);

-- Storage policies for project-files bucket
-- Bu kısım Supabase Dashboard'dan yapılmalı:
-- 1. project-files bucket oluştur
-- 2. Authenticated users can upload
-- 3. Users can only access their project files

