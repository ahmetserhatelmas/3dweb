# Termin Tarihi Özelliği Kurulumu

Bu migration tedarikçilerin tekliflerinde termin tarihi belirtmesini sağlar.

## Migration Adımları

1. **Supabase Dashboard'a giriş yapın**
   - https://supabase.com adresinden projenize giriş yapın

2. **SQL Editor'ü açın**
   - Sol menüden "SQL Editor" seçin

3. **Migration SQL'i çalıştırın**
   - `supabase/migration-quotation-delivery-date.sql` dosyasının içeriğini kopyalayın
   - SQL Editor'e yapıştırın
   - "Run" butonuna tıklayın

4. **Doğrulama**
   ```sql
   -- project_suppliers tablosunu kontrol edin
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'project_suppliers';
   
   -- delivery_date kolonu görünmeli
   ```

## Özellik Özeti

✅ **Tedarikçi**: Teklif verirken termin tarihi girebilir
✅ **Müşteri**: Gelen tekliflerde termin tarihini görebilir
✅ **Kabul**: Teklif kabul edildiğinde projenin termin tarihi otomatik güncellenir

## Test Senaryosu

1. Müşteri olarak giriş yapın ve yeni bir proje oluşturun
2. Tedarikçi olarak giriş yapın
3. Teklifte fiyat, termin tarihi ve not girin
4. Müşteri olarak teklifi görüntüleyin - termin tarihi görünmeli
5. Teklifi kabul edin
6. Proje detayında termin tarihinin güncellendiğini kontrol edin

