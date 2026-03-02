-- Teklif süresi: 3 gün, süresi dolunca expired, müşteri 1 gün uzatabilir, e-posta bildirimleri

-- 1. project_suppliers: teklif son tarihi ve hatırlatma
ALTER TABLE public.project_suppliers
ADD COLUMN IF NOT EXISTS quote_due_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS quote_deadline_extended_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS quote_reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.project_suppliers.quote_due_at IS 'Teklif verme son tarihi (proje oluşturulduğunda +3 gün)';
COMMENT ON COLUMN public.project_suppliers.quote_deadline_extended_at IS 'Müşteri 1 gün uzattığında set edilir';
COMMENT ON COLUMN public.project_suppliers.quote_reminder_sent_at IS 'Son 1 gün kala hatırlatma e-postası gönderildi mi';

-- 2. status'a 'expired' ekle (süresi doldu)
ALTER TABLE public.project_suppliers DROP CONSTRAINT IF EXISTS project_suppliers_status_check;
ALTER TABLE public.project_suppliers
ADD CONSTRAINT project_suppliers_status_check
CHECK (status IN ('pending', 'quoted', 'accepted', 'rejected', 'expired'));
