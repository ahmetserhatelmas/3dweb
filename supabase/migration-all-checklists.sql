-- =============================================
-- TÜM CHECKLIST YAPILARINI GÜNCELLEME
-- =============================================

-- PART 1: PROJE KONTROL LİSTESİ
-- =============================================
DELETE FROM public.checklist_templates;

INSERT INTO public.checklist_templates (name, description, order_index, is_active) VALUES
('Sözleşme ve Teknik Mütakabat', 'Proje başlangıç ve anlaşma süreci', 1, true),
('Üretim', 'Üretim süreçleri', 2, true),
('Kalite Kontrol', 'Kalite güvence ve kontrol', 3, true),
('Teslimat', 'Ürün teslimat süreci', 4, true),
('Kabul', 'Müşteri kabul süreci', 5, true);

-- PART 2: PARÇA (STEP DOSYASI) CHECKLIST
-- =============================================
DELETE FROM public.step_checklist_templates;

-- Üretim Hazırlık (ana başlık + alt başlıklar)
INSERT INTO public.step_checklist_templates (name, description, order_index, is_active) VALUES
('Üretim Hazırlık', 'PARENT', 100, true),
('Takım, Fikstür, Aparat Temin/Tasarım', 'Gerekli alet ve ekipman temini', 101, true),
('Programlama', 'CNC programlama', 102, true),
('Hammadde Temin Ve Giriş Kontrol', 'Hammadde tedarik ve kontrol', 103, true);

-- Planlama (ana başlık + alt başlıklar)
INSERT INTO public.step_checklist_templates (name, description, order_index, is_active) VALUES
('Planlama', 'PARENT', 200, true),
('Üretim Planlama ve Çizelgeleme', 'Üretim zaman planlaması', 201, true),
('Operatör Eğitimi', 'Personel eğitimi', 202, true);

-- Üretim (ana başlık + alt başlıklar)
INSERT INTO public.step_checklist_templates (name, description, order_index, is_active) VALUES
('Üretim', 'PARENT', 300, true),
('Operasyon (talaşlı imalat, lazer kesim, vs)', 'Ana üretim operasyonları', 301, true),
('Temizlik (çapak alma, deburlama vs)', 'Temizlik işlemleri', 302, true),
('Isıl İşlem', 'Isıl işlem uygulaması', 303, true),
('Yüzey İşlem (kaplama, boya, sertlik vs.)', 'Yüzey işlemleri', 304, true);

-- Kalite Kontrol (ana başlık + alt başlıklar)
INSERT INTO public.step_checklist_templates (name, description, order_index, is_active) VALUES
('Kalite Kontrol', 'PARENT', 400, true),
('Final Ölçüm', 'Son ölçüm kontrolü', 401, true),
('Görsel Kontrol', 'Görsel muayene', 402, true);

-- =============================================
-- NOTLAR
-- =============================================
-- checklist_templates: Proje seviyesi checklist (5 madde, basit liste)
-- step_checklist_templates: STEP dosyası seviyesi checklist (hiyerarşik, parent-child)
-- description='PARENT' olanlar ana başlık, diğerleri alt başlık
-- Alt başlıklar tiklendiğinde, parent otomatik tiklenecek (backend logic)
