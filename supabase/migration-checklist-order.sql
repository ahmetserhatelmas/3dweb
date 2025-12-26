-- =============================================
-- Checklist Items Order Index Migration
-- =============================================

-- 1. Add order_index column to checklist_items
ALTER TABLE public.checklist_items 
ADD COLUMN IF NOT EXISTS order_index INTEGER;

-- 2. Update existing checklist items with order_index based on created_at
-- This preserves existing order as much as possible
WITH numbered AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at, id) as row_num
  FROM public.checklist_items
)
UPDATE public.checklist_items ci
SET order_index = numbered.row_num
FROM numbered
WHERE ci.id = numbered.id;

-- 3. Verify the update
SELECT 
  project_id, 
  id, 
  title, 
  order_index, 
  created_at 
FROM public.checklist_items 
ORDER BY project_id, order_index;

