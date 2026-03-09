-- Migration: Add file completion tracking to project_files
-- Tedarikçi her dosyayı (parçayı) ayrı ayrı tamamlayabilir

ALTER TABLE project_files 
  ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES profiles(id);
