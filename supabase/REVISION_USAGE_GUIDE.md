# 🔄 REVİZYON SİSTEMİ - KULLANIM KILAVUZU

## 📋 Genel Bakış

Revizyon sistemi, proje dosyalarında yapılan değişikliklerin takibini ve onayını sağlar. İki farklı revizyon tipi vardır:

### 1️⃣ Geometri Revizyonu
- STEP dosyasının değiştirilmesi
- Yeni dosya yüklenir
- Tedarikçi kabul ederse:
  - Eski dosya "aktif değil" olarak işaretlenir
  - Yeni dosya aktif revizyon olur
  - **Checklist sıfırlanır** (işlem baştan yapılır)

### 2️⃣ Adet Revizyonu
- Parça geometrisi aynı kalır, sadece adet değişir
- İki seçenek:
  - **Sadece dosya:** Sadece bu dosya etkilenir
  - **Tüm proje:** Proje geneli etkilenir
- Tedarikçi kabul ederse:
  - Adet güncellenir
  - **Checklist sıfırlanmaz** (işlem devam eder)

## 🔤 Revizyon Harfleri

- İlk dosya: **Rev. A**
- İkinci revizyon: **Rev. B**
- Üçüncü revizyon: **Rev. C**
- ... Z'den sonra AA, AB, ...

## 👥 Roller ve Yetkiler

### Müşteri (Customer)
✅ Revizyon talebi oluşturabilir
✅ Revizyon geçmişini görüntüleyebilir
❌ Revizyon taleplerini kabul/red edemez

### Tedarikçi (Supplier)
✅ Revizyon taleplerini görüntüleyebilir
✅ Revizyon taleplerini kabul/red edebilir
✅ Red ederken sebep yazmalı
❌ Revizyon talebi oluşturamaz

### Admin
✅ Her şeyi görebilir
✅ Tüm işlemleri yapabilir

## 🎯 Kullanım Adımları

### Müşteri İçin: Revizyon Talebi Oluşturma

1. Proje detay sayfasında dosyayı seçin
2. **"Revizyon Talebi Oluştur"** butonuna tıklayın
3. Revizyon tipini seçin:
   - Geometri Revizyonu → Yeni dosya yükleyin
   - Adet Revizyonu → Yeni adet girin
4. Açıklama yazın (zorunlu)
5. **"Revizyon Talebi Oluştur"** butonuna tıklayın
6. Tedarikçinin onayını bekleyin

### Tedarikçi İçin: Revizyon Onaylama/Reddetme

1. Proje detay sayfasında dosyayı seçin
2. **"Bekleyen Revizyon Talepleri"** bölümünü görün
3. Talebi inceleyin:
   - Revizyon tipi
   - Açıklama
   - Eski → Yeni değişiklikler
4. Karar verin:
   - **Kabul Et:** Revizyon uygulanır, aktif revizyon güncellenir
   - **Reddet:** Sebep yazın (zorunlu)

## 📊 Revizyon Geçmişi

**"Revizyon Geçmişi"** butonuna tıklayarak:
- Tüm geçmiş revizyonları görebilirsiniz
- Kim, ne zaman, ne değiştirdi
- Checklist sıfırlandı mı?
- Eski ve yeni değerler

## 🎨 Görsel Göstergeler

### Durum İkonları
- ⏱️ **Bekliyor:** Sarı (Pending)
- ✅ **Kabul Edildi:** Yeşil (Accepted)
- ❌ **Reddedildi:** Kırmızı (Rejected)

### Revizyon Kartları
- Bekleyen talepler **sarı kenarlık**
- Kabul edilenler **yeşil kenarlık**
- Reddedilenler **kırmızı kenarlık**

## 🔐 Güvenlik ve Erişim

- Sadece ilgili proje tarafları revizyon taleplerini görebilir
- Müşteriler sadece kendi projelerinde revizyon talebi oluşturabilir
- Tedarikçiler sadece atandıkları projelerde revizyon onaylayabilir
- Tüm işlemler veritabanında loglanır

## ⚠️ Önemli Notlar

1. **Geometri revizyonu checklist'i sıfırlar!**
   - Kabul etmeden önce dikkatli düşünün
   - Tüm kontroller baştan yapılacak

2. **Revizyon kabul edildikten sonra geri alınamaz**
   - Ancak yeni bir revizyon talebi oluşturulabilir

3. **Eski revizyonlar silinmez**
   - Tüm geçmiş korunur
   - İstediğiniz zaman görüntüleyebilirsiniz

4. **Sadece aktif revizyon üzerinde çalışılır**
   - Eski revizyonlar salt okunur

## 🚀 API Endpoints (Geliştiriciler İçin)

```
GET    /api/revisions/projects/:projectId/revision-requests
POST   /api/revisions/projects/:projectId/files/:fileId/revise
POST   /api/revisions/revision-requests/:requestId/accept
POST   /api/revisions/revision-requests/:requestId/reject
GET    /api/revisions/files/:fileId/revisions
```

## 📁 Veritabanı Tabloları

1. **project_files**
   - `revision`: Revizyon harfi (A, B, C, ...)
   - `is_active`: Aktif revizyon mu?
   - `parent_file_id`: Önceki revizyon

2. **revision_requests**
   - Revizyon talepleri
   - Durum: pending / accepted / rejected

3. **revision_history**
   - Tüm revizyon geçmişi
   - Kim, ne zaman, ne değişti

4. **projects**
   - `current_revision`: Projenin genel revizyon harfi

## 💡 Örnek Senaryolar

### Senaryo 1: Geometri Değişikliği
1. Müşteri: "Parçanın kalınlığını 2mm'den 3mm'ye çıkardım"
2. Geometri revizyonu oluşturur, yeni STEP dosyası yükler
3. Tedarikçi kabul eder
4. Rev. A → Rev. B
5. Checklist sıfırlanır, işlem baştan başlar

### Senaryo 2: Adet Artışı
1. Müşteri: "10 adet yerine 15 adet istiyorum"
2. Adet revizyonu oluşturur (10 → 15)
3. "Sadece dosya" seçeneğini seçer
4. Tedarikçi kabul eder
5. Rev. A → Rev. B
6. Checklist devam eder

### Senaryo 3: Revizyon Reddi
1. Müşteri revizyon talebi oluşturur
2. Tedarikçi reddeder: "Malzeme tedarik süresi uzun, kabul edemiyoruz"
3. Müşteri red nedenini görür
4. Yeni bir görüşme yapabilirler

## 🛠️ Sorun Giderme

**Revizyon talebi oluşturamıyorum**
- Sadece müşteriler revizyon talebi oluşturabilir
- Proje tamamlanmış olabilir (completed)
- Proje teklif aşamasında olabilir (is_quotation)

**Revizyon kabul edemiyorum**
- Sadece atanmış tedarikçi kabul edebilir
- Talep zaten işlenmiş olabilir

**Revizyon geçmişi görünmüyor**
- Henüz revizyon yapılmamış olabilir
- "Revizyon Geçmişi" butonuna tıklayın

## 📞 Destek

Herhangi bir sorun yaşarsanız:
- Backend loglarını kontrol edin
- Browser console'u kontrol edin
- Database'de revision_requests tablosunu kontrol edin

---

**Son Güncelleme:** 18 Ocak 2026
**Versiyon:** 1.0.0

