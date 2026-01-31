-- =====================================================
-- PROJE KONTROL LİSTESİ MİGRASYONU
-- =====================================================

-- 1. Eski proje checklist template'lerini temizle
DELETE FROM public.checklist_templates;

-- 2. YENİ PROJE KONTROL LİSTESİ TEMPLATE'LERİ
INSERT INTO public.checklist_templates (name, description, order_index, is_active) VALUES
('Sözleşme ve Teknik Mütakabat', 'Proje başlangıç ve anlaşma süreci', 1, true),
('Üretim', 'Üretim süreçleri', 2, true),
('Kalite Kontrol', 'Kalite güvence ve kontrol', 3, true),
('Teslimat', 'Ürün teslimat süreci', 4, true),
('Kabul', 'Müşteri kabul süreci', 5, true);

COMMENT ON TABLE public.checklist_templates IS 'Proje seviyesi checklist template''leri (file_id=NULL). Her yeni proje oluşturulduğunda bu template''ler checklist_items tablosuna kopyalanır.';
