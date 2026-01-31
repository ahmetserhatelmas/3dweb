-- =====================================================
-- YENİ CHECKLIST YAPISI MİGRASYONU
-- =====================================================

-- 1. Eski template'leri temizle
DELETE FROM public.step_checklist_templates;

-- 2. YENİ PARÇA (STEP DOSYASI) CHECKLIST TEMPLATE'LERİ
-- Her STEP dosyası için otomatik oluşturulacak hiyerarşik checklist'ler

-- 3. PARÇA CHECKLIST TEMPLATE'LERİ (hiyerarşik yapı)
-- order_index ile gruplama: X00 = ana başlık, X01-X99 = alt başlıklar

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

-- 4. NOT: Backend'de proje oluşturulurken bu template'ler kullanılarak
-- checklist_items tablosuna kopyalanacak ve parent_id ilişkisi kurulacak
-- description = 'PARENT' olanlar ana başlık, diğerleri alt başlık olarak işlenecek

COMMENT ON TABLE public.step_checklist_templates IS 'STEP dosyaları için checklist template''leri. order_index ile gruplama: X00=parent, X01-X99=children. description=PARENT ise ana başlık.';
