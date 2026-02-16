# 🚂 Railway Deployment Guide

## Backend Deployment (Railway)

### 1. Railway Environment Variables

Railway Dashboard → Project → Variables → Add the following:

```bash
# Environment
NODE_ENV=production

# Supabase (Backend)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Server Config
PORT=3001

# Frontend URL (for CORS)
FRONTEND_URL=https://kunye.tech

# Email (Google Workspace)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=info@kunye.tech
SMTP_PASS=your_google_app_password_here

# Email Confirmation
REQUIRE_EMAIL_CONFIRMATION=true

# Sentry Backend (from screenshot: node-express project)
SENTRY_DSN=https://dc139f2a0a980a83fbf7ea4eca9543ec@o4510858040115200.ingest.de.sentry.io/4510858045554768
```

### 2. Railway Settings

**Root Directory:** `/` (default)
**Build Command:** `npm install`
**Start Command:** `npm run start:backend`

---

## Frontend Deployment (Vercel/Netlify)

### 1. Environment Variables

**Vercel Dashboard → Settings → Environment Variables:**

```bash
# API URL (Railway backend URL)
VITE_API_URL=https://your-railway-app.up.railway.app

# Supabase (Frontend)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Sentry Frontend (create separate project in Sentry)
VITE_SENTRY_DSN=https://your_frontend_sentry_dsn@sentry.io/project_id
```

### 2. Vercel Settings

**Framework Preset:** Vite
**Root Directory:** `frontend`
**Build Command:** `npm run build`
**Output Directory:** `dist`
**Install Command:** `npm install`

---

## 🔒 Güvenlik Kontrol Listesi

### Railway (Backend)
- [ ] `NODE_ENV=production` ayarlandı
- [ ] `SENTRY_DSN` eklendi (Backend Sentry project)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` eklendi (admin key)
- [ ] `SMTP_PASS` eklendi (Google App Password)
- [ ] `FRONTEND_URL` doğru domain'e ayarlandı
- [ ] `REQUIRE_EMAIL_CONFIRMATION=true` (production için)

### Vercel (Frontend)
- [ ] `VITE_API_URL` Railway backend URL'ine ayarlandı
- [ ] `VITE_SUPABASE_ANON_KEY` eklendi (public key)
- [ ] `VITE_SENTRY_DSN` eklendi (Frontend Sentry project)
- [ ] Environment variables **Production**, **Preview**, **Development** için ayarlandı

---

## 📸 Sentry Dashboard'dan Aldığınız Bilgiler

Ekran görüntüsünden:
- **Sentry Project:** node-express
- **DSN:** `https://dc139f2a0a980a83fbf7ea4eca9543ec@o4510858040115200.ingest.de.sentry.io/4510858045554768`
- **Son Hata:** 16h ago - TypeError (unhandled)

### Sentry'de Yapılacaklar:

1. **Frontend için ayrı project oluştur:**
   - Sentry Dashboard → Create Project
   - Platform: React
   - Yeni DSN'i kopyala → `VITE_SENTRY_DSN` olarak kullan

2. **Alert Kuralları Ekle:**
   - Settings → Alerts → Create Alert Rule
   - Email/Slack bildirimlerini aktive et
   - "New issue" ve "High error rate" için uyarı kur

3. **Backend hatayı incele:**
   - Dashboard'da "TypeError: Cannot read properties of undefined"
   - Hangi endpoint'te olduğunu kontrol et
   - Fix yap ve deploy et

---

## 🚀 Deployment Adımları

### Adım 1: Backend'i Railway'e Deploy Et

```bash
# Local'de test et
npm run start:backend

# Railway'e push (otomatik deploy)
git add .
git commit -m "Add production environment variables"
git push origin main
```

Railway otomatik deploy edecek. Dashboard'dan log'ları izle.

### Adım 2: Frontend'i Vercel'e Deploy Et

```bash
# Local'de production build test et
cd frontend
npm run build
npm run preview

# Vercel'e deploy (CLI veya GitHub integration)
vercel --prod
```

### Adım 3: Domain Ayarları

1. **Railway Backend URL'i kopyala:**
   - Railway Dashboard → Settings → Public Networking
   - URL: `https://your-app-name.up.railway.app`

2. **Vercel'de environment variable güncelle:**
   - `VITE_API_URL` = Railway URL'i

3. **Railway'de CORS güncelle:**
   - `FRONTEND_URL` = Vercel domain'i (örn: `https://kunye.tech`)

### Adım 4: Test

1. **Backend Health Check:**
   ```bash
   curl https://your-railway-app.up.railway.app/api/health
   ```

2. **Frontend açılıyor mu:**
   - https://kunye.tech
   - Login/Register test et
   - Sentry'de hata loglarını kontrol et

---

## 🐛 Sentry'deki Hatayı Düzelt

Ekran görüntüsünde görünen hata:
```
TypeError: Cannot read properties of undefined (reading 'errorHandler')
```

Bu `server.js` satır 169'da. Muhtemelen:

```javascript
// ❌ Hatalı
app.use(Sentry.Handlers.errorHandler())

// ✅ Doğru (SENTRY_DSN yoksa skip et)
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler())
}
```

Zaten kodda bu düzeltme var (satır 270-272), ama eski deploy'da yoktu.

---

## 📊 Monitoring

### 1. Sentry Dashboard
- Günlük error rate izle
- Alert'leri Slack'e bağla

### 2. Railway Metrics
- CPU/Memory kullanımı
- Response time
- Error logs

### 3. Supabase Dashboard
- Database size (500MB limit - Free plan)
- API requests
- Storage usage

---

## 💰 Maliyet Tahmini

| Servis | Plan | Maliyet |
|--------|------|---------|
| Railway | Hobby ($5/month) | $5 |
| Vercel | Free (Hobby) | $0 |
| Supabase | Free → Pro | $0-25 |
| Sentry | Free (10k events) | $0 |
| **TOPLAM** | | **$5-30/ay** |

Railway Free plan ile başlayabilirsin (500 saat/ay), müşteri sayısı artınca Hobby'ye geç.

---

## ✅ Deployment Checklist

### Pre-deployment:
- [x] OCCT lisans notu eklendi
- [x] Sentry environment variable'a çevrildi
- [x] `.env.example` güncellendi
- [ ] Local'de production mode test edildi
- [ ] Tüm environment variables hazır

### Post-deployment:
- [ ] Backend health check çalışıyor
- [ ] Frontend açılıyor
- [ ] Login/Register çalışıyor
- [ ] Sentry hata yakalıyor (test endpoint ile)
- [ ] Email gönderimi çalışıyor
- [ ] Rate limiting aktif
- [ ] CORS ayarları doğru

---

## 🆘 Sorun Giderme

### Backend 500 Hatası
```bash
# Railway logs kontrol et
railway logs

# En sık hatalar:
# 1. Environment variable eksik
# 2. SUPABASE_SERVICE_ROLE_KEY yanlış
# 3. CORS hatası (FRONTEND_URL yanlış)
```

### Frontend API Bağlanamıyor
```bash
# Browser console'da:
# 1. VITE_API_URL doğru mu?
# 2. CORS error var mı?
# 3. Railway backend running mi?

# Fix:
# Vercel → Settings → Environment Variables
# VITE_API_URL = https://your-railway-app.up.railway.app
# Redeploy
```

### Sentry Çalışmıyor
```bash
# 1. DSN doğru mu?
# 2. Environment variable adı doğru mu? (VITE_ prefix)
# 3. Sentry.init() çalışıyor mu?

# Test:
# Development: /api/test-sentry endpoint'ine git
# Production: Kasıtlı hata oluştur, Sentry'de görünmeli
```

---

**Hazır mısın?** Railway'e deploy edelim! 🚀
