# Railway Deployment Guide

## Backend (Railway)

### 1. Railway'e Git
1. https://railway.app adresine git
2. GitHub ile giriş yap
3. "New Project" tıkla
4. "Deploy from GitHub repo" seç
5. `ahmetserhatelmas/3dweb` repository'sini seç

### 2. Environment Variables Ekle
Railway dashboard'da **Variables** sekmesine git ve ekle:

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PORT=3001
```

### 3. Root Directory Ayarla (ÖNEMLİ!)
- Settings → Root Directory: `/` (boş bırak veya root)
- Start Command: `npm run start:backend`

### 4. Deploy
- Otomatik deploy başlayacak
- Deploy bitince Railway URL'ini al (örn: `https://your-app.up.railway.app`)

---

## Frontend (Vercel) - Ücretsiz

### 1. Vercel'e Git
1. https://vercel.com adresine git
2. GitHub ile giriş yap
3. "Add New Project" tıkla
4. `ahmetserhatelmas/3dweb` repository'sini seç

### 2. Build Ayarları
```
Framework Preset: Vite
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
```

### 3. Environment Variables
Vercel'de **Environment Variables** ekle:
```
VITE_API_URL=https://your-railway-backend-url.up.railway.app
```

### 4. Deploy
- "Deploy" butonuna tıkla
- Frontend hazır! (örn: `https://your-app.vercel.app`)

---

## Supabase Ayarları

1. Supabase Dashboard → Settings → API
2. **Allowed Redirect URLs** ekle:
   - `https://your-vercel-app.vercel.app`
   - `https://your-railway-app.up.railway.app`

3. **CORS Origins** ekle:
   - `https://your-vercel-app.vercel.app`

---

## ✅ Tamamlandı!

Backend URL: Railway'den al
Frontend URL: Vercel'den al

Test et ve kullanmaya başla! 🚀





