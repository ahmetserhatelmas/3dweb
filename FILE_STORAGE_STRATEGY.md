# 📦 Dosya Depolama ve Limit Stratejisi

## 🔍 Mevcut Durum (100MB Limit)

### Dosya Upload Limitleri:

**Backend (`backend/routes/upload.js`):**
```javascript
// Satır 53-55
const uploadStep = multer({ 
  limits: { fileSize: 100 * 1024 * 1024 }  // 100MB - STEP files
})
const uploadDocument = multer({ 
  limits: { fileSize: 20 * 1024 * 1024 }   // 20MB - PDF/DOC
})
const uploadProjectFiles = multer({ 
  limits: { fileSize: 100 * 1024 * 1024 }  // 100MB - All project files
})
```

**Server Request Limit (`backend/server.js`):**
```javascript
// Satır 101-102
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
```

### Platform Limitleri:

| Platform | Upload Limit | Notes |
|----------|--------------|-------|
| **Multer** | 100MB | Ayarlanabilir (kodda) |
| **Express** | 10MB | JSON body limit (sadece API için) |
| **Supabase Free** | 1GB total, 50MB/file | Free plan |
| **Supabase Pro** | 100GB total, unlimited file size | $25/month |
| **Railway** | Depends on plan | Network timeout ~30s |

---

## ⚠️ Problem: Büyük STEP Dosyaları

### STEP Dosya Boyutları:
- **Basit parça:** 1-10 MB
- **Orta karmaşıklık:** 10-50 MB
- **Karmaşık montaj:** 50-200 MB
- **Çok karmaşık:** 200MB+ (assemblies with 1000+ parts)

### Şu Anki Sorunlar:
1. **100MB limit** - Büyük montaj dosyaları yüklenemiyor
2. **Supabase Free 50MB/file** - Platform limiti
3. **Railway timeout** - 30 saniye network timeout
4. **Yavaş upload** - Büyük dosyalar için kullanıcı deneyimi kötü

---

## 🎯 ÇÖZÜM 1: Limitleri Artır (Kolay)

### Adım 1: Multer Limitini Artır

**`backend/routes/upload.js`** güncelle:
```javascript
// 100MB → 500MB
const uploadStep = multer({ 
  storage, 
  fileFilter: stepFilter, 
  limits: { fileSize: 500 * 1024 * 1024 }  // 500MB
})

const uploadProjectFiles = multer({ 
  storage, 
  fileFilter: projectFileFilter, 
  limits: { fileSize: 500 * 1024 * 1024 }  // 500MB
})
```

### Adım 2: Express Body Limit (JSON için değil, multipart için)

Express body limit sadece JSON/URL-encoded için. Multipart uploads (dosya upload) için geçerli değil.

### Adım 3: Supabase Pro'ya Geç

**Free → Pro:**
- ❌ Free: 50MB/file limit
- ✅ Pro: Unlimited file size
- Maliyet: **$25/month**

### Adım 4: Railway Timeout Ayarı

Railway'de timeout artırılamıyor ama şu çözümler var:
1. **Chunked upload** kullan (parça parça yükleme)
2. **Direct Supabase upload** - Railway'i bypass et

**👍 Öneri:** 500MB yeterli olur, çoğu STEP dosyası 200MB altında.

---

## 🎯 ÇÖZÜM 2: Cloudflare R2 (En İyi)

### Cloudflare R2 Nedir?

- **S3-Compatible** object storage
- **Zero egress fees** (indirme ücretsiz!)
- **10GB Free** storage
- **CDN entegrasyonu** ile hızlı indirme
- **Global edge locations**

### Fiyatlandırma:

| | Cloudflare R2 | Supabase Pro |
|---|---|---|
| **Storage** | $0.015/GB/month | $0.125/GB/month (8GB included) |
| **Upload** | Free | Free |
| **Download** | **FREE** 🎉 | Bandwidth dahil (250GB) |
| **Requests** | $0.36/million | Unlimited |
| **Base Plan** | $0 (Pay as you go) | $25/month |

**Örnek Hesaplama (100 proje, ortalama 50MB STEP):**
- Storage: 5GB
- Cloudflare R2: 5GB × $0.015 = **$0.075/month** 💰
- Supabase Pro: **$25/month** + extra storage

### Cloudflare Avantajları:

1. **🚀 Hız:** CDN edge'den indirme (global)
2. **💰 Maliyet:** Download ücretsiz (bandwith sorununu çözer)
3. **📈 Ölçeklenebilirlik:** TB'larca dosya için ideal
4. **🔒 Güvenlik:** Pre-signed URLs ile güvenli indirme
5. **⚡ Railway'i bypass:** Direct browser → R2 upload

---

## 🏗️ Mimari: Cloudflare R2 Entegrasyonu

```
┌─────────────┐
│   Browser   │
│  (Customer) │
└──────┬──────┘
       │
       │ 1. Request pre-signed URL
       ↓
┌─────────────────┐
│  Railway API    │ ← Supabase DB (metadata)
│  (Backend)      │
└──────┬──────────┘
       │
       │ 2. Generate R2 pre-signed URL
       ↓
┌─────────────────┐
│ Cloudflare R2   │ ← STEP files (actual storage)
│   (Storage)     │
└─────────────────┘
       ↑
       │ 3. Direct upload/download
       │
┌─────────────┐
│   Browser   │
└─────────────┘
```

### Veri Akışı:

**Upload:**
1. Frontend → Backend'e "dosya yükleyeceğim" request
2. Backend → Cloudflare R2'den pre-signed upload URL al
3. Frontend → R2'ye direkt upload (Railway'i bypass eder)
4. Backend → Supabase'e metadata kaydet (file_path, size, etc.)

**Download:**
1. Frontend → Backend'e "dosya indir" request
2. Backend → R2'den pre-signed download URL al (24 saat geçerli)
3. Frontend → R2'den direkt indir (CDN edge'den)

**Avantajlar:**
- ✅ Railway timeout sorunu yok (direkt R2'ye upload)
- ✅ Çok hızlı indirme (CDN edge locations)
- ✅ Bandwidth ücretsiz
- ✅ Çok ucuz

---

## 📊 Karşılaştırma: Supabase vs Cloudflare R2

### Senaryo: 100 Müşteri, 200 Proje, 10GB STEP Dosyası

| Metrik | Supabase Storage | Cloudflare R2 |
|--------|------------------|---------------|
| **Storage Cost** | $25/month (8GB dahil) | $0.15/month (10GB) |
| **Download Cost** | Dahil (250GB/month) | **FREE** ❤️ |
| **Upload Speed** | Orta (Railway → Supabase) | Hızlı (Direct R2) |
| **Download Speed** | Orta (single region) | Çok hızlı (global CDN) |
| **Max File Size** | Unlimited (Pro) | Unlimited |
| **Bandwidth Limit** | 250GB/month sonra ücret | **Unlimited FREE** |
| **Setup Karmaşıklığı** | Kolay ✅ | Orta 🔨 |
| **TOPLAM MALIYET** | **$25/month** | **$0.15/month** |

---

## 🚀 Öneri: Aşamalı Geçiş

### Aşama 1: Hızlı Fix (Bugün - 5 dakika)
```javascript
// backend/routes/upload.js
limits: { fileSize: 500 * 1024 * 1024 }  // 100MB → 500MB
```

**Sonuç:** Çoğu STEP dosyası yüklenebilir, ama Supabase Free'de problem olabilir.

### Aşama 2: Supabase Pro (Bu hafta - 5 dakika)
- Supabase Dashboard → Billing → Upgrade to Pro
- **Maliyet:** $25/month
- **Sonuç:** 500MB dosyalar yüklenebilir, limit problemi çözülür

### Aşama 3: Cloudflare R2 (1 ay içinde - 2 gün geliştirme)
- R2 bucket oluştur
- Pre-signed URL sistemi kur
- Frontend'te direkt R2 upload
- **Maliyet:** ~$0.15/month
- **Sonuç:** Hız + Ölçeklenebilirlik + Maliyet tasarrufu

---

## 💡 Cloudflare R2 Kurulum Rehberi

### 1. Cloudflare R2 Bucket Oluştur

```bash
# Cloudflare Dashboard
https://dash.cloudflare.com/

# Steps:
1. R2 → Create Bucket
2. Name: kunye-step-files
3. Location: Automatic (closest to users)
```

### 2. API Token Oluştur

```bash
# Cloudflare → R2 → Manage R2 API Tokens
# Permissions:
- Object Read & Write
- Bucket List

# .env ekle:
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=kunye-step-files
```

### 3. Backend'e S3 SDK Ekle

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### 4. Upload Route Güncelle

**`backend/routes/upload-r2.js`** (yeni dosya):
```javascript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
})

// Get pre-signed upload URL
router.post('/upload-url', authenticateToken, async (req, res) => {
  try {
    const { fileName, fileType } = req.body
    const key = `projects/${uuidv4()}-${fileName}`
    
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: fileType
    })
    
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 })
    
    res.json({ uploadUrl, key })
  } catch (error) {
    console.error('R2 upload URL error:', error)
    res.status(500).json({ error: 'Failed to generate upload URL' })
  }
})

// Get pre-signed download URL
router.post('/download-url', authenticateToken, async (req, res) => {
  try {
    const { key } = req.body
    
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key
    })
    
    const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 86400 }) // 24 hours
    
    res.json({ downloadUrl })
  } catch (error) {
    console.error('R2 download URL error:', error)
    res.status(500).json({ error: 'Failed to generate download URL' })
  }
})
```

### 5. Frontend Upload (React)

```javascript
// Upload flow
const uploadToR2 = async (file) => {
  // 1. Get pre-signed URL from backend
  const { uploadUrl, key } = await fetch('/api/upload-url', {
    method: 'POST',
    body: JSON.stringify({ 
      fileName: file.name, 
      fileType: file.type 
    })
  }).then(r => r.json())
  
  // 2. Upload directly to R2 (bypass Railway)
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type }
  })
  
  // 3. Save metadata to Supabase
  await fetch('/api/files', {
    method: 'POST',
    body: JSON.stringify({
      file_name: file.name,
      file_path: key,  // R2 key
      file_size: file.size
    })
  })
}
```

---

## 📋 Karar Matrisi

### Şu An (İlk 50 Müşteri):
✅ **Supabase Storage + 500MB limit**
- Kolay
- Hızlı kurulum
- $25/month (Pro plan)

### 100+ Müşteri Olunca:
✅ **Cloudflare R2**
- Maliyet tasarrufu (20x daha ucuz)
- Çok hızlı (global CDN)
- Sınırsız bandwidth

---

## 🎯 SONRAKİ ADIMLAR

### Bu Hafta:
1. ✅ Multer limitini 500MB'a çıkar
2. ✅ Supabase Pro'ya geç ($25/month)
3. ✅ Railway'e environment variables ekle

### Gelecekte (100+ müşteri):
1. 🔄 Cloudflare R2 kur
2. 🔄 Migration script yaz (Supabase → R2)
3. 🔄 Frontend'i direkt R2 upload'a geçir

---

## 💰 Maliyet Özeti (100 Proje, 10GB)

| Çözüm | Şimdi | 1 Yıl | 5 Yıl |
|-------|-------|-------|-------|
| **Supabase Storage** | $25 | $300 | $1,500 |
| **Cloudflare R2** | $0.15 | $1.80 | $9 |
| **Tasarruf** | - | **$298** | **$1,491** 💰 |

---

## ✅ Özet

**Kısa vadede (bugün):**
```javascript
// backend/routes/upload.js - satır 53
limits: { fileSize: 500 * 1024 * 1024 }  // 500MB
```

**Orta vadede (bu hafta):**
- Supabase Pro'ya geç
- SMTP ve Sentry variables'ları Railway'e ekle

**Uzun vadede (100+ müşteri):**
- Cloudflare R2'ye geç
- 20x maliyet tasarrufu
- Çok daha hızlı indirme
- Sınırsız bandwidth

**Cloudflare için:** ✅ EVET, kesinlikle mantıklı! Hem hız hem maliyet açısından çok daha iyi.
