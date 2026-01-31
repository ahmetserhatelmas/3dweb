-- Add file_type column to documents table for contract PDFs

ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'document';

-- Add index for file_type
CREATE INDEX IF NOT EXISTS idx_documents_file_type ON public.documents(file_type);

COMMENT ON COLUMN public.documents.file_type IS 'Type of document: document, contract, certificate, report, etc.';
