-- Migration: Add Customer Role Support
-- This migration adds support for "customer" role and created_by tracking

-- 1. Add customer role to profiles table
ALTER TABLE public.profiles 
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'customer', 'user'));

-- 2. Add created_by column to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);

-- 3. Drop old policies and create new ones for projects

-- Projects SELECT policies
DROP POLICY IF EXISTS "Admins can view all projects" ON public.projects;
DROP POLICY IF EXISTS "Customers can view their projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view assigned projects" ON public.projects;

CREATE POLICY "Admins can view all projects"
    ON public.projects FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Customers can view their projects"
    ON public.projects FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'customer'
        )
        AND created_by = auth.uid()
    );

CREATE POLICY "Users can view assigned projects"
    ON public.projects FOR SELECT
    TO authenticated
    USING (assigned_to = auth.uid());

-- Projects INSERT policies
DROP POLICY IF EXISTS "Admins can create projects" ON public.projects;
DROP POLICY IF EXISTS "Customers can create projects" ON public.projects;

CREATE POLICY "Admins can create projects"
    ON public.projects FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Customers can create projects"
    ON public.projects FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'customer'
        )
    );

-- Projects UPDATE policies
DROP POLICY IF EXISTS "Admins can update projects" ON public.projects;
DROP POLICY IF EXISTS "Customers can update their projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update assigned projects" ON public.projects;

CREATE POLICY "Admins can update projects"
    ON public.projects FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Customers can update their projects"
    ON public.projects FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'customer'
        )
        AND created_by = auth.uid()
    );

CREATE POLICY "Users can update assigned projects"
    ON public.projects FOR UPDATE
    TO authenticated
    USING (assigned_to = auth.uid());

-- 4. Update checklist policies

DROP POLICY IF EXISTS "Users can view checklist items for their projects" ON public.checklist_items;
DROP POLICY IF EXISTS "Customers can create checklist items" ON public.checklist_items;
DROP POLICY IF EXISTS "Customers can delete checklist items" ON public.checklist_items;
DROP POLICY IF EXISTS "Users can update checklist items for their projects" ON public.checklist_items;

CREATE POLICY "Users can view checklist items for their projects"
    ON public.checklist_items FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = checklist_items.project_id
            AND (
                p.assigned_to = auth.uid()
                OR p.created_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
                )
            )
        )
    );

CREATE POLICY "Customers can create checklist items"
    ON public.checklist_items FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'customer'
        )
    );

CREATE POLICY "Customers can delete checklist items"
    ON public.checklist_items FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'customer'
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
                OR p.created_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
                )
            )
        )
    );

-- 5. Update documents policies

DROP POLICY IF EXISTS "Users can view documents for their projects" ON public.documents;
DROP POLICY IF EXISTS "Users can upload documents to their projects" ON public.documents;

CREATE POLICY "Users can view documents for their projects"
    ON public.documents FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = documents.project_id
            AND (
                p.assigned_to = auth.uid()
                OR p.created_by = auth.uid()
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
                OR p.created_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
                )
            )
        )
    );

-- 6. Add storage policy for customers

CREATE POLICY "Customers can upload STEP files"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'step-files'
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'customer'
        )
    );

-- 7. Update the handle_new_user trigger function to NOT set created_by automatically
-- created_by will be set by the backend API only

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, role, company_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
        NEW.raw_user_meta_data->>'company_name'
    )
    ON CONFLICT (id) DO NOTHING;
    -- Note: created_by will be set by the backend API
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

