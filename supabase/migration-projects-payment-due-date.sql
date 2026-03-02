-- Vade tarihi: müşteri proje açarken isteğe bağlı girebilir; sözleşmede Ödeme koşullarına yazılır
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS payment_due_date DATE;

COMMENT ON COLUMN public.projects.payment_due_date IS 'Ödeme vade tarihi; sözleşmede Ödeme koşullarına yazılır. Boşsa "Teslimattan sonra 30 gün içinde" kullanılır.';
