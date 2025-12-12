-- =============================================
-- M-Chain MVP - Supabase Database Schema
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. USERS TABLE (extends Supabase auth.users)
-- =============================================
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    company_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- =============================================
-- 2. PROJECTS TABLE
-- =============================================
CREATE TABLE public.projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    part_number TEXT NOT NULL,
    assigned_to UUID NOT NULL REFERENCES public.profiles(id),
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    deadline DATE,
    step_file_path TEXT,
    step_file_name TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Projects policies
-- Admins can see all projects
CREATE POLICY "Admins can view all projects"
    ON public.projects FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Users can see projects assigned to them
CREATE POLICY "Users can view assigned projects"
    ON public.projects FOR SELECT
    TO authenticated
    USING (assigned_to = auth.uid());

-- Admins can create projects
CREATE POLICY "Admins can create projects"
    ON public.projects FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Admins can update any project
CREATE POLICY "Admins can update projects"
    ON public.projects FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Users can update their assigned projects (status only)
CREATE POLICY "Users can update assigned projects"
    ON public.projects FOR UPDATE
    TO authenticated
    USING (assigned_to = auth.uid());

-- =============================================
-- 3. CHECKLIST ITEMS TABLE
-- =============================================
CREATE TABLE public.checklist_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    is_checked BOOLEAN DEFAULT FALSE,
    checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

-- Checklist policies
CREATE POLICY "Users can view checklist items for their projects"
    ON public.checklist_items FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = checklist_items.project_id
            AND (
                p.assigned_to = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
                )
            )
        )
    );

CREATE POLICY "Admins can create checklist items"
    ON public.checklist_items FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Users can update checklist items for their projects"
    ON public.checklist_items FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = checklist_items.project_id
            AND (
                p.assigned_to = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
                )
            )
        )
    );

CREATE POLICY "Admins can delete checklist items"
    ON public.checklist_items FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- =============================================
-- 4. DOCUMENTS TABLE
-- =============================================
CREATE TABLE public.documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    checklist_item_id UUID REFERENCES public.checklist_items(id),
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Documents policies
CREATE POLICY "Users can view documents for their projects"
    ON public.documents FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = documents.project_id
            AND (
                p.assigned_to = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
                )
            )
        )
    );

CREATE POLICY "Users can upload documents to their projects"
    ON public.documents FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = documents.project_id
            AND (
                p.assigned_to = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
                )
            )
        )
    );

-- =============================================
-- 5. FUNCTIONS & TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for projects
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, role, company_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
        NEW.raw_user_meta_data->>'company_name'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 6. STORAGE BUCKETS
-- =============================================
-- Run these in Supabase Dashboard > Storage

-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('step-files', 'step-files', false);

-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('documents', 'documents', false);

-- =============================================
-- 7. STORAGE POLICIES (run in SQL Editor)
-- =============================================

-- STEP files bucket policies
CREATE POLICY "Admins can upload STEP files"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'step-files'
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Authenticated users can view STEP files"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'step-files');

-- Documents bucket policies
CREATE POLICY "Users can upload documents"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Authenticated users can view documents"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'documents');

-- =============================================
-- 8. VIEWS (Optional - for easier queries)
-- =============================================

-- Project summary view
CREATE OR REPLACE VIEW public.project_summary AS
SELECT 
    p.id,
    p.name,
    p.part_number,
    p.status,
    p.deadline,
    p.step_file_path,
    p.step_file_name,
    p.created_at,
    p.updated_at,
    creator.username AS creator_username,
    creator.company_name AS creator_company,
    supplier.id AS supplier_id,
    supplier.username AS supplier_username,
    supplier.company_name AS supplier_name,
    (SELECT COUNT(*) FROM public.checklist_items ci WHERE ci.project_id = p.id) AS total_items,
    (SELECT COUNT(*) FROM public.checklist_items ci WHERE ci.project_id = p.id AND ci.is_checked = true) AS checked_items
FROM public.projects p
LEFT JOIN public.profiles creator ON p.created_by = creator.id
LEFT JOIN public.profiles supplier ON p.assigned_to = supplier.id;

-- =============================================
-- 9. SEED DATA (Optional - for testing)
-- =============================================

-- Note: Users should be created via Supabase Auth
-- After creating users, you can update their profiles:

-- UPDATE public.profiles 
-- SET role = 'admin', company_name = 'TUSAŞ Mühendislik'
-- WHERE username = 'admin@example.com';

-- UPDATE public.profiles 
-- SET role = 'user', company_name = 'ABC Makina Ltd.'
-- WHERE username = 'tedarikci@example.com';






