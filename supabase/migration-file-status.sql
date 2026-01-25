-- Add status column to project_files for pending revision previews
ALTER TABLE public.project_files
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'inactive'));

COMMENT ON COLUMN public.project_files.status IS 'Dosya durumu: active (aktif), pending (revizyon bekliyor), inactive (eski revizyon)';

-- Update existing files to have proper status based on is_active
UPDATE public.project_files
SET status = CASE 
  WHEN is_active = true THEN 'active'
  WHEN is_active = false THEN 'inactive'
  ELSE 'active'
END;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_project_files_status ON public.project_files(status);

-- Add pending_file_id to revision_requests to track preview files
ALTER TABLE public.revision_requests
ADD COLUMN IF NOT EXISTS pending_file_id UUID REFERENCES public.project_files(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.revision_requests.pending_file_id IS 'Geçici önizleme dosyası (tedarikçi onayı bekleyen)';


