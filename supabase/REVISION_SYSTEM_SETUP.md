# 🔄 Revizyon Sistemi Kurulum Kılavuzu

## Genel Bakış

Bu sistem, parça bazlı revizyon yönetimi sağlar:
- ✅ **Harf bazlı revizyonlar** (Rev. A → B → C → ...)
- ✅ **İki revizyon tipi:** Geometri & Adet
- ✅ **Onay mekanizması** (Müşteri ister, Tedarikçi onaylar)
- ✅ **Revizyon geçmişi** (Tüm değişiklikler arşivlenir)
- ✅ **Karşılaştırma** (Eski/yeni versiyonlar)

## 📋 Kurulum Adımları

### 1️⃣ Migration Çalıştırın

Supabase Dashboard > SQL Editor:

```bash
# Dosya: supabase/migration-revision-system.sql
```

Bu migration:
- `project_files` tablosuna revizyon kolonları ekler
- `revision_requests` tablosu oluşturur
- `revision_history` tablosu oluşturur
- RLS politikaları ekler
- Helper fonksiyonlar ekler

### 2️⃣ Backend Endpoints (Yapılacak)

```
POST   /api/projects/:projectId/files/:fileId/revise        - Revizyon talebi oluştur
GET    /api/projects/:projectId/files/:fileId/revisions     - Revizyon geçmişi
POST   /api/revision-requests/:requestId/accept             - Revizyon kabul
POST   /api/revision-requests/:requestId/reject             - Revizyon red
GET    /api/projects/:projectId/revision-requests           - Bekleyen talepler
```

### 3️⃣ Frontend Components (Yapılacak)

- `RevisionButton` - Dosya kartında "Revize Et" butonu
- `RevisionRequestForm` - Revizyon talep formu
- `RevisionHistory` - Geçmiş görüntüleme
- `RevisionComparison` - Eski/yeni karşılaştırma
- `RevisionApproval` - Kabul/Red UI (tedarikçi için)

## 🎯 Kullanım Senaryoları

### Senaryo 1: Geometri Revizyonu

**Adımlar:**
1. Müşteri proje detayında bir STEP dosyasının üzerine tıklar
2. "Revize Et" butonuna basar
3. Form açılır:
   - Revizyon tipi: Geometri
   - Yeni STEP dosyası yükler
   - Açıklama yazar
4. Teklif gönderir
5. Tedarikçiye bildirim gider
6. Tedarikçi:
   - Eski ve yeni dosyayı karşılaştırır
   - Kabul veya Red eder (sebep yazabilir)
7. Kabul edilirse:
   - Yeni dosya aktif olur (Rev. B)
   - Eski dosya arşive taşınır (Rev. A - sadece görüntüleme)
   - **Checklist sıfırlanır** ⚠️
   - Proje revizyonu artar

### Senaryo 2: Adet Revizyonu

**Adımlar:**
1. Müşteri dosya üzerinde "Revize Et"
2. Form:
   - Revizyon tipi: Adet
   - Yeni adet: 15 (eskisi 10)
   - Etkileme: 
     - [ ] Sadece bu parça
     - [x] Tüm proje (termin, fiyat etkilenebilir)
   - Açıklama
3. Tedarikçi onaylar/reddeder
4. Kabul edilirse:
   - Adet güncellenir
   - **Checklist sıfırlanmaz** ✅
   - Eski adet geçmişte tutulur

### Senaryo 3: Revizyon Geçmişi Görüntüleme

**Herkes:**
- Dosya detayında "Revizyon Geçmişi" sekmesi
- Liste:
  - Rev. C (Aktif) - 18.01.2026 - Geometri değişti
  - Rev. B (Arşiv) - 15.01.2026 - Adet: 10 → 15
  - Rev. A (Arşiv) - 10.01.2026 - İlk versiyon
- Tıklanabilir - eski dosyalar ve checklist görünür

## 📊 Veritabanı Yapısı

### project_files (Güncellenmiş)
```sql
- revision: VARCHAR(10)           -- A, B, C, ...
- is_active: BOOLEAN              -- Sadece biri true
- parent_file_id: UUID            -- Revizyon zinciri
```

### revision_requests (Yeni)
```sql
- revision_type: 'geometry' | 'quantity'
- from_revision: 'A'
- to_revision: 'B'
- status: 'pending' | 'accepted' | 'rejected'
- new_file_url: TEXT              -- Geometri için
- old_quantity, new_quantity      -- Adet için
- affect_scope: 'file_only' | 'project_wide'
```

### revision_history (Yeni)
```sql
- revision: 'B'
- revision_type: 'geometry' | 'quantity'
- change_summary: TEXT
- old_value, new_value: JSONB
- checklist_reset: BOOLEAN
```

## 🔔 Bildirimler (Gelecek Özellik)

- Tedarikçiye: "Yeni revizyon talebi"
- Müşteriye: "Revizyon kabul/red edildi"
- Email/Push notification desteği

## ⚠️ Önemli Notlar

1. **Checklist Sıfırlama:**
   - Geometri revizyonu → Checklist sıfırlanır
   - Adet revizyonu → Checklist korunur

2. **Aktif Revizyon:**
   - Bir dosya için sadece bir revizyon aktif olabilir
   - Eski revizyonlar sadece görüntüleme modunda

3. **Revizyon Zinciri:**
   - Her revizyon bir öncekini referans eder
   - Geçmiş tamamen tutulur

4. **Proje Revizyonu:**
   - Herhangi bir dosya revize olursa proje revizyonu artar
   - Proje revizyonu: En yüksek dosya revizyonu

## 🚀 Sonraki Adımlar

1. ✅ Migration çalıştır
2. ⏳ Backend endpoints yaz
3. ⏳ Frontend components oluştur
4. ⏳ Test et
5. ⏳ Bildirim sistemi ekle

---

**Not:** Bu büyük bir özellik. Aşamalı olarak geliştireceğiz:
- **Faz 1:** Backend + Temel UI
- **Faz 2:** Karşılaştırma & Görselleştirme
- **Faz 3:** Bildirimler & İyileştirmeler

