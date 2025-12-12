# M-Chain MVP

Web Tabanlı Teknik Veri Paylaşım ve Doğrulama Platformu

## 🎯 Proje Özeti

Mühendislik ve İmalat (Tedarikçi) arasındaki teknik veri paylaşımını kolaylaştıran, 3D görüntüleme ve interaktif onay süreçlerini içeren web tabanlı bir SaaS platformu.

## ✨ Özellikler

- **3D STEP Viewer**: Tarayıcıda STEP dosyalarını görüntüleme
- **Ölçüm Aracı**: Model üzerinde mesafe ölçümü (mm)
- **Admin Paneli**: Proje oluşturma, dosya yükleme, checklist hazırlama
- **Tedarikçi Paneli**: İş listesi, 3D inceleme, onay süreci
- **Durum Takibi**: Bekliyor / İnceleniyor / Tamamlandı

## 🚀 Kurulum

### Gereksinimler

- Node.js 18+
- npm veya yarn

### Adımlar

1. **Bağımlılıkları yükleyin:**

```bash
npm install
cd frontend && npm install && cd ..
```

2. **Veritabanını oluşturun:**

```bash
npm run setup
```

3. **Uygulamayı başlatın:**

```bash
npm run dev
```

4. **Tarayıcıda açın:**

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## 🔑 Demo Hesapları

| Rol | Kullanıcı | Şifre |
|-----|-----------|-------|
| Admin | admin | admin123 |
| Tedarikçi | tedarikci | user123 |
| Tedarikçi | tedarikci2 | user123 |

## 📁 Proje Yapısı

```
├── backend/
│   ├── db/           # Veritabanı bağlantısı
│   ├── middleware/   # Auth middleware
│   ├── routes/       # API endpoints
│   ├── server.js     # Express server
│   └── setup-db.js   # DB kurulum scripti
├── frontend/
│   └── src/
│       ├── components/   # React bileşenleri
│       ├── context/      # Auth context
│       ├── pages/        # Sayfa bileşenleri
│       └── styles/       # CSS dosyaları
├── data/             # SQLite veritabanı
├── uploads/          # Yüklenen dosyalar
└── public/           # Static dosyalar
```

## 🛠 Teknolojiler

- **Frontend**: React 18, Vite, Three.js, occt-import-js
- **Backend**: Node.js, Express
- **Database**: SQLite (better-sqlite3)
- **Auth**: JWT
- **3D**: Three.js + OpenCascade (WASM)

## 📝 API Endpoints

### Auth
- `POST /api/auth/login` - Giriş
- `GET /api/auth/me` - Kullanıcı bilgisi
- `GET /api/auth/suppliers` - Tedarikçi listesi

### Projects
- `GET /api/projects` - Proje listesi
- `GET /api/projects/:id` - Proje detayı
- `POST /api/projects` - Yeni proje
- `PATCH /api/projects/:id/checklist/:itemId` - Checklist güncelle
- `POST /api/projects/:id/complete` - İşi tamamla

### Upload
- `POST /api/upload/step/:projectId` - STEP dosyası yükle
- `POST /api/upload/document/:projectId` - Döküman yükle

## 📄 Lisans

MIT






