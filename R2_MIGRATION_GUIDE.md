# Cloudflare R2 Storage Setup

## ✅ Migration Tamamlandı!

Tüm dosya yüklemeleri artık **Cloudflare R2** kullanıyor. Supabase Storage yerine R2 kullanmanın avantajları:

- ✅ **Ücretsiz 10 GB** storage
- ✅ **Sınırsız ücretsiz egress** (bandwidth)
- ✅ **10x daha ucuz** (sonrasında $0.015/GB)
- ✅ **Supabase Pro'dan 10x daha ekonomik**

---

## 🚀 Kurulum Adımları

### 1. Cloudflare R2 Bucket Oluşturma

1. **Cloudflare Dashboard** → **R2** sekmesine gidin
2. **"Create bucket"** tıklayın
3. **Bucket Name:** `kunye-project-files`
4. **Location:** Automatic (en yakın bölge)
5. **Create** tıklayın

### 2. R2 API Token Oluşturma

1. **R2** → **Manage R2 API Tokens**
2. **"Create API Token"** tıklayın
3. **Token name:** `kunye-backend-token`
4. **Permissions:** 
   - ✅ Object Read & Write
5. **Bucket scope:** `kunye-project-files`
6. **Create API Token**
7. **⚠️ Credentials'ları kopyalayın** (bir daha göremezsiniz):
   - Access Key ID
   - Secret Access Key
   - Endpoint URL

### 3. Public Access (Opsiyonel)

**Custom domain kullanmak isterseniz:**

1. **Bucket Settings** → **Connect Domain**
2. Domain: `files.kunye.tech` (örnek)
3. Cloudflare DNS'de CNAME ekleyin
4. `.env` dosyasında `R2_PUBLIC_URL` güncelleyin

**Veya R2.dev subdomain kullanın (ücretsiz):**

1. **Bucket Settings** → **R2.dev subdomain**
2. **Allow Access** tıklayın
3. URL'yi kopyalayın: `https://pub-xxxxx.r2.dev`
4. `.env` dosyasına ekleyin

### 4. Environment Variables

`.env` dosyanıza ekleyin:

```bash
# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=kunye-project-files
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

**Account ID bulma:**
- Cloudflare Dashboard → R2 → Settings → Account ID

### 5. Backend'i Yeniden Başlatma

```bash
cd /Users/ase/Desktop/3dweb
node backend/server.js
```

---

## 📊 Kullanım İstatistikleri

Backend artık otomatik olarak **`file_size`** kaydediyor. Plan kullanım istatistikleri:

```
Starter Plan:
- 3 kullanıcı
- 10 tedarikçi
- 10 RFQ/ay
- 1 GB storage

Business Plan:
- 10 kullanıcı
- 40 tedarikçi
- 100 RFQ/ay
- 10 GB storage
```

---

## 🔄 Mevcut Dosyalar

**Supabase Storage'daki eski dosyalar:**
- ❌ Otomatik migrate edilmeyecek
- ✅ Yeni yüklenen dosyalar R2'de
- ⚠️ Eski dosya URL'leri çalışmaya devam eder

**İsterseniz eski dosyaları migrate edebiliriz ama gerek yok.**

---

## 🧪 Test

Yeni proje oluşturun ve dosya yükleyin:

1. Müşteri panelinde **Yeni Proje** oluşturun
2. STEP/PDF dosyası yükleyin
3. Database'de `project_files` tablosunda:
   - ✅ `file_url` → R2 URL olmalı
   - ✅ `file_size` → Dosya boyutu (byte)
4. Plan istatistiklerinde depolama artmalı

---

## 💰 Maliyet Karşılaştırması

**Supabase Pro:**
- $25/ay
- 100 GB storage
- 200 GB bandwidth
- **Toplam:** $25/ay minimum

**Cloudflare R2:**
- İlk 10 GB ücretsiz
- Sonrası $0.015/GB/ay
- Bandwidth ücretsiz
- **100 GB için:** ~$1.35/ay
- **500 GB için:** ~$7.50/ay

**Tasarruf:** 10x-20x daha ucuz! 🎉

---

## 🔧 Troubleshooting

**Hata: "Access denied"**
```
→ R2 API Token permissions kontrol edin
→ Bucket name doğru mu?
```

**Hata: "Endpoint not found"**
```
→ R2_ACCOUNT_ID doğru mu?
→ Endpoint URL: https://{ACCOUNT_ID}.r2.cloudflarestorage.com
```

**Dosya URL'si açılmıyor:**
```
→ R2.dev subdomain aktif mi?
→ Veya custom domain CNAME doğru mu?
```

---

## ✅ Checklist

- [ ] Cloudflare R2 bucket oluşturuldu
- [ ] API Token oluşturuldu
- [ ] `.env` dosyası güncellendi
- [ ] Backend yeniden başlatıldı
- [ ] Test dosyası yüklendi
- [ ] Plan istatistikleri çalışıyor

---

## 📝 Notlar

- R2 S3-compatible API kullanır
- AWS SDK ile çalışır
- Supabase database değişmedi (sadece storage)
- Migration geri alınabilir (Supabase'e dönmek kolay)
