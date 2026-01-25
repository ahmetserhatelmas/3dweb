# 🚀 REVİZYON SİSTEMİ KURULUMU

## ✅ Adım 1: Database Migration

Supabase SQL Editor'da aşağıdaki dosyayı çalıştırın:

```bash
supabase/migration-revision-system.sql
```

Bu migration:
- ✅ `project_files` tablosuna revizyon kolonları ekler
- ✅ `revision_requests` tablosu oluşturur
- ✅ `revision_history` tablosu oluşturur
- ✅ `projects` tablosuna `current_revision` ekler
- ✅ RLS politikalarını ayarlar
- ✅ Helper function'ları ekler

## ✅ Adım 2: Backend Route Ekle

`backend/server.js` dosyası zaten güncellenmiş durumda:

```javascript
import revisionRoutes from './routes/revisions.js'
app.use('/api/revisions', revisionRoutes)
```

## ✅ Adım 3: Frontend Component Ekle

Componentler zaten eklendi:
- ✅ `frontend/src/components/RevisionManager.jsx`
- ✅ `frontend/src/components/RevisionManager.css`
- ✅ `frontend/src/lib/api.js` (API fonksiyonları eklendi)
- ✅ `frontend/src/pages/ProjectDetail.jsx` (RevisionManager entegre edildi)

## ✅ Adım 4: Backend Restart

Eğer backend çalışıyorsa restart edin:

```bash
cd backend
npm run dev
```

## ✅ Adım 5: Test

### Test 1: Müşteri olarak revizyon talebi oluştur
1. Müşteri hesabıyla giriş yap
2. Bir projeye git
3. Bir dosya seç
4. "Revizyon Talebi Oluştur" butonuna tıkla
5. Geometri revizyonu seç
6. Yeni dosya yükle
7. Açıklama yaz
8. Gönder

### Test 2: Tedarikçi olarak revizyon kabul et
1. Tedarikçi hesabıyla giriş yap
2. Projeye git
3. Dosyayı seç
4. "Bekleyen Revizyon Talepleri" bölümünü gör
5. "Kabul Et" butonuna tıkla
6. Revizyon uygulanmalı

### Test 3: Revizyon geçmişini görüntüle
1. "Revizyon Geçmişi" butonuna tıkla
2. Tüm revizyonlar görünmeli
3. Değişiklikler detaylı gösterilmeli

## 🔍 Kontrol Listesi

- [ ] Migration başarıyla çalıştı
- [ ] Backend restart edildi
- [ ] Frontend'de RevisionManager görünüyor
- [ ] Müşteri revizyon talebi oluşturabiliyor
- [ ] Tedarikçi revizyon kabul edebiliyor
- [ ] Revizyon geçmişi görüntülenebiliyor
- [ ] Revizyon harfleri doğru artıyor (A → B → C)
- [ ] Geometri revizyonunda checklist sıfırlanıyor
- [ ] Adet revizyonunda checklist korunuyor

## ⚠️ Bilinen Sorunlar ve Çözümler

### Sorun: "delivery_date column not found"
**Çözüm:** `migration-quotation-delivery-date.sql` migration'ını da çalıştırın.

### Sorun: "Cannot read properties of undefined (reading 'id')"
**Çözüm:** Sayfayı refresh edin, backend'in çalıştığından emin olun.

### Sorun: Revizyon talebi oluşturulamıyor
**Çözüm:** 
- Browser console'u kontrol edin
- Backend loglarını kontrol edin
- RLS politikalarının doğru ayarlandığından emin olun

## 📊 Database Check

Migration'dan sonra kontrol edin:

```sql
-- project_files tablosunda yeni kolonlar var mı?
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'project_files' 
AND column_name IN ('revision', 'is_active', 'parent_file_id');

-- Yeni tablolar oluşturuldu mu?
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('revision_requests', 'revision_history');

-- Mevcut dosyalar Rev. A olarak işaretlendi mi?
SELECT id, file_name, revision, is_active 
FROM project_files 
LIMIT 5;
```

## 🎉 Tamamlandı!

Revizyon sistemi artık aktif. Kullanım detayları için:
- `REVISION_USAGE_GUIDE.md` dosyasını okuyun
- Test senaryolarını deneyin
- Kullanıcılara bilgi verin

---

**Kurulum Tarihi:** 18 Ocak 2026

