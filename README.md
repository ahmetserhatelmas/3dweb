# Kunye - Teknik Veri Paylaşım Platformu

Web Tabanlı Teknik Veri Paylaşım ve Doğrulama Platformu

## 🎯 Proje Özeti

Müşteriler, Tedarikçiler ve Mühendislik ekipleri arasındaki teknik veri paylaşımını kolaylaştıran, 3D görüntüleme ve interaktif onay süreçlerini içeren web tabanlı bir SaaS platformu.

## ✨ Özellikler

- **3D STEP Viewer**: Tarayıcıda STEP dosyalarını görüntüleme
- **Ölçüm Aracı**: Model üzerinde mesafe ölçümü (mm)
- **Çoklu Rol Sistemi**: Admin, Müşteri ve Tedarikçi rolleri
- **Admin Paneli**: Müşteri/Tedarikçi oluşturma, proje yönetimi
- **Müşteri Paneli**: Kendi tedarikçilerini oluşturma, proje atama
- **Tedarikçi Paneli**: İş listesi, 3D inceleme, döküman yükleme, onay süreci
- **Checklist Sistemi**: Proje bazlı kontrol listesi
- **Durum Takibi**: Bekliyor / İnceleniyor / Tamamlandı
- **Döküman Yönetimi**: Tedarikçi döküman yükleme/silme

## 🔐 Rol Sistemi

| Rol | Yetkiler |
|-----|----------|
| **Admin** | Tüm kullanıcıları ve projeleri yönetir |
| **Müşteri** | Kendi tedarikçilerini oluşturur, proje atar |
| **Tedarikçi** | Atanan projeleri görür, checklist'i tamamlar |

## 🚀 Kurulum

### Gereksinimler

- Node.js 18+
- npm veya yarn
- Supabase hesabı

### Adımlar

1. **Bağımlılıkları yükleyin:**

```bash
npm install
cd frontend && npm install && cd ..
```

2. **Supabase kurulumu:**

- Supabase'de yeni proje oluşturun
- `supabase/schema.sql` dosyasını SQL Editor'da çalıştırın
- `.env` dosyası oluşturun:

```env
SUPABASE_URL=your-project-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
```

3. **Uygulamayı başlatın:**

```bash
npm run dev
```

4. **Tarayıcıda açın:**

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## 🔑 Giriş Sistemi

Kullanıcı adı ve şifre ile giriş yapılır (email kullanılmaz).

```
Kullanıcı Adı: admin
Şifre: admin123
```

## 📁 Proje Yapısı

```
├── backend/
│   ├── db/           # Supabase bağlantısı
│   ├── middleware/   # Auth middleware
│   ├── routes/       # API endpoints
│   └── server.js     # Express server
├── frontend/
│   └── src/
│       ├── components/   # React bileşenleri
│       ├── context/      # Auth context
│       ├── lib/          # API helpers
│       ├── pages/        # Sayfa bileşenleri
│       └── styles/       # CSS dosyaları
├── supabase/         # Schema ve migration dosyaları
└── public/           # Static dosyalar (WASM vb.)
```

## 🛠 Teknolojiler

- **Frontend**: React 18, Vite, Three.js, occt-import-js
- **Backend**: Node.js, Express
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Auth**: Supabase Auth + JWT
- **3D**: Three.js + OpenCascade (WASM)
- **Security**: Helmet.js, Rate Limiting, Sentry
- **Deployment**: Railway (Backend) + Vercel (Frontend)

## 🔒 Güvenlik & Monitoring

- **Error Tracking**: Sentry.io
- **Rate Limiting**: Express Rate Limit (DDoS koruması)
- **Security Headers**: Helmet.js (OWASP standardları)
- **Health Check**: `/api/health` endpoint
- **Graceful Shutdown**: SIGTERM/SIGINT handling

## 📜 Lisanslar & Yasal Uyarılar

### 3D Viewer - Open CASCADE Technology
Bu uygulama, 3D STEP dosyalarını görüntülemek için [Open CASCADE Technology (OCCT)](https://www.opencascade.com/) kullanmaktadır.

- **Lisans**: [LGPL 2.1](https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html)
- **Ticari Kullanım**: İzinli (LGPL koşulları altında)
- **Kaynak Kodu**: https://github.com/donalffons/opencascade.js

LGPL 2.1 lisansı gereği, OCCT kullanımı bildirilmiş ve kaynak koduna link verilmiştir. Bu yazılım, OCCT'yi değiştirilmemiş WASM binary olarak kullanmaktadır.

### Proje Lisansı
MIT License - Diğer tüm kodlar için

---

**⚠️ Production Checklist:** Canlıya almadan önce `PRODUCTION_CHECKLIST.md` dosyasını okuyun!

## 📝 API Endpoints

### Auth
- `POST /api/auth/login` - Kullanıcı adı ile giriş
- `POST /api/auth/register` - Yeni kullanıcı kayıt
- `GET /api/auth/me` - Kullanıcı bilgisi
- `GET /api/auth/users` - Kullanıcı listesi (rol bazlı filtreleme)
- `GET /api/auth/suppliers` - Tedarikçi listesi
- `PATCH /api/auth/users/:id` - Kullanıcı güncelle
- `DELETE /api/auth/users/:id` - Kullanıcı sil

### Projects
- `GET /api/projects` - Proje listesi (rol bazlı)
- `GET /api/projects/:id` - Proje detayı
- `POST /api/projects` - Yeni proje
- `PATCH /api/projects/:id/checklist/:itemId` - Checklist güncelle
- `DELETE /api/projects/:id/documents/:documentId` - Döküman sil
- `POST /api/projects/:id/complete` - İşi tamamla

### Upload
- `POST /api/upload/step/:projectId` - STEP dosyası yükle
- `POST /api/upload/document/:projectId` - Döküman yükle

### Health
- `GET /api/health` - Sunucu sağlık kontrolü

## 🌐 Deployment

### Backend (Railway)
- Railway.app'da deploy edilir
- Environment variables eklenir
- Otomatik keepalive cron job ile Supabase aktif tutulur

### Frontend (Vercel)
- Vercel'de deploy edilir
- `VITE_API_URL` environment variable olarak Railway URL'i eklenir
- SPA routing için vercel.json yapılandırması

## 📄 Lisans

MIT

## 🔗 Bağlantılar

- [Production Checklist](PRODUCTION_CHECKLIST.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Open CASCADE Technology](https://www.opencascade.com/)

