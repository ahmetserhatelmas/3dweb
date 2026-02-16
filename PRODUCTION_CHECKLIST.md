# 🚀 Production Checklist - Kunye.tech

## ❌ KRİTİK - Hemen Yapılmalı

### 1. Sentry Kurulumu (Error Tracking)
```bash
# Backend
npm install @sentry/node @sentry/profiling-node

# Frontend
cd frontend
npm install @sentry/react
```

**Backend setup** (`backend/server.js` başına):
```javascript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 0.1,
});

// Middleware (hataları yakalamak için en sona ekle)
app.use(Sentry.Handlers.errorHandler());
```

**Frontend setup** (`frontend/src/main.jsx`):
```javascript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

**Kayıt:** https://sentry.io/signup/ (GitHub ile ücretsiz)

---

### 2. Rate Limiting (DDoS Koruması)
```bash
npm install express-rate-limit
```

**Backend'e ekle** (`backend/server.js`):
```javascript
import rateLimit from 'express-rate-limit';

// Genel rate limit
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // IP başına 100 istek
  message: 'Çok fazla istek gönderdiniz, lütfen 15 dakika sonra tekrar deneyin.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth endpoint'leri için daha sıkı limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 15 dakikada 5 login denemesi
  skipSuccessfulRequests: true,
  message: 'Çok fazla giriş denemesi, 15 dakika sonra tekrar deneyin.',
});

// Upload için limit
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 saat
  max: 20, // 1 saatte 20 upload
  message: 'Çok fazla dosya yüklendi, 1 saat sonra tekrar deneyin.',
});

// Middleware'leri ekle
app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/upload', uploadLimiter);
```

---

### 3. Security Headers (Helmet.js)
```bash
npm install helmet
```

**Backend'e ekle** (`backend/server.js`):
```javascript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.SUPABASE_URL],
      workerSrc: ["'self'", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false, // STEP viewer için gerekli
}));
```

---

### 4. Environment Variables Kontrolü

**Production .env kontrolü ekle** (`backend/server.js` başına):
```javascript
// Production check
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SENTRY_DSN',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS'
  ];
  
  const missing = requiredEnvVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing.join(', '));
    process.exit(1);
  }
}
```

---

## ⚠️ ORTA ÖNCELİK - 1 Hafta İçinde

### 5. Request Size Limit
**Mevcut durum:** Sınırsız (büyük dosya ile sunucuyu doldurabilirler)

**Çözüm** (`backend/server.js`):
```javascript
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
```

---

### 6. CORS Ayarları Sıkılaştırma
**Şu an:** Tüm originlere açık

**Çözüm** (`backend/server.js`):
```javascript
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://kunye.tech', 'https://www.kunye.tech']
    : ['http://localhost:5173', 'http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

---

### 7. Database Connection Pooling
**Supabase için ekstra ayar yok ama bağlantı sayısını izle**

Supabase Dashboard → Settings → Database:
- **Connection pooling:** Enabled (default)
- **Max connections:** Free plan = 60, Pro = 200

---

### 8. Graceful Shutdown
**Sunucu kapanırken bağlantıları temiz kapat**

**Backend'e ekle** (`backend/server.js` en sonuna):
```javascript
// Graceful shutdown
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
```

---

## 📝 Lisans & Legal

### OCCT WASM Lisansı
**Dosya:** `public/occt-import-js.wasm` (7.3MB)

**Lisans:** LGPL 2.1 (Open CASCADE Technology)
- ✅ Ticari kullanım: **İZİNLİ** (LGPL altında)
- ⚠️ **Gereksinim:** LGPL lisansını belirtmeli ve kaynak koda link vermeli
- 📄 **Çözüm:** Footer'a lisans notu ekle

**Footer'a ekle** (`frontend/src/pages/Home.jsx` veya global footer):
```jsx
<footer>
  <p>
    This application uses <a href="https://www.opencascade.com/">Open CASCADE Technology</a>,
    licensed under <a href="https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html">LGPL 2.1</a>.
  </p>
</footer>
```

**Tam uyumluluk için:**
1. Proje README'sine OCCT kullanımını ekle
2. Lisans dosyasına LGPL 2.1 referansı ekle
3. OCCT kaynak koduna link ver

---

## 🗄️ Supabase Plan Kontrolü

### Free Plan Limitleri:
- Database: 500 MB
- Storage: 1 GB
- Bandwidth: 2 GB/ay
- Realtime: 200 concurrent connections
- Auth: 50,000 Monthly Active Users

### Monitoring:
1. Supabase Dashboard → Settings → Usage
2. Alarmlar kur:
   - Database %80 dolunca
   - Storage %80 dolunca
   - Bandwidth %80'de

### Pro Plan ($25/ay):
- Database: 8 GB
- Storage: 100 GB
- Bandwidth: 250 GB/ay
- Daily backups (7 gün)

**Öneri:** İlk 20-50 müşteriye kadar Free plan yeterli, sonra Pro'ya geç.

---

## 🔐 Güvenlik Ekstraları

### 9. File Upload Validation (Daha Sıkı)
**Mevcut:** Extension check var

**Ekle** (`backend/routes/upload.js`):
```javascript
import fileType from 'file-type';

// Magic number check (extension spoofing'e karşı)
const buffer = await fs.readFile(file.path);
const type = await fileType.fromBuffer(buffer);

if (!type || !allowedTypes.includes(type.mime)) {
  throw new Error('Invalid file type');
}
```

---

### 10. SQL Injection Koruması
**Mevcut:** Supabase ORM kullanıyorsunuz, güvenli ✅

**Kontrol:** Raw SQL sorgusu varsa parametre kullan:
```javascript
// ✅ Güvenli
const { data } = await supabase
  .from('profiles')
  .select('*')
  .eq('username', username);

// ❌ Tehlikeli (kullanmayın)
const { data } = await supabase.rpc('raw_query', {
  query: `SELECT * FROM profiles WHERE username = '${username}'`
});
```

---

## 📊 Monitoring & Alerts

### 11. Health Check Endpoint (Mevcut ✅)
**Geliştirilmiş versiyon:**
```javascript
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: 'unknown'
  };
  
  // Database check
  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .select('count')
      .limit(1);
    health.database = error ? 'error' : 'ok';
  } catch (e) {
    health.database = 'error';
  }
  
  res.status(health.database === 'ok' ? 200 : 503).json(health);
});
```

**UptimeRobot ile izle:** https://uptimerobot.com (ücretsiz)

---

## ✅ Backup & Recovery

### 12. Supabase Backup
**Otomatik:** Supabase her gün backup alıyor (Pro plan'da 7 gün)

**Manuel backup:**
```bash
# Database export
npx supabase db dump -f backup.sql

# Restore
npx supabase db reset
psql -f backup.sql
```

**Öneri:** 
- Haftada 1 manuel backup al ve Google Drive'a yükle
- Kritik verileri CSV olarak export et

---

## 🚀 Deployment Checklist

### Deploy öncesi kontrol:
- [ ] Sentry kuruldu ve test edildi
- [ ] Rate limiting aktif
- [ ] Helmet.js eklendi
- [ ] Environment variables kontrol edildi
- [ ] CORS production domain'lere ayarlandı
- [ ] OCCT lisans notu eklendi
- [ ] Database backup alındı
- [ ] Health check endpoint test edildi
- [ ] SSL sertifikası aktif (Vercel/Railway otomatik)
- [ ] Domain DNS ayarları yapıldı

### Deploy sonrası:
- [ ] Sentry'de hata akışını izle (ilk 24 saat)
- [ ] Rate limit log'larını kontrol et
- [ ] Supabase usage dashboard'u izle
- [ ] Health check endpoint'i UptimeRobot'a ekle
- [ ] Test kullanıcısı ile end-to-end test

---

## 💰 Maliyet Tahmini (Aylık)

| Servis | Plan | Maliyet |
|--------|------|---------|
| Supabase | Free → Pro | $0 → $25 |
| Railway (Backend) | Hobby | $5 |
| Vercel (Frontend) | Free | $0 |
| Sentry | Free | $0 |
| UptimeRobot | Free | $0 |
| Domain (.tech) | - | ~$5/yıl |
| **TOPLAM** | | **$5-30/ay** |

**Break-even:** ~10 müşteri ile Pro plan'a geç

---

## 📞 Destek & İzleme

1. **Hata bildirimleri:** Sentry → Email/Slack
2. **Uptime izleme:** UptimeRobot → SMS/Email
3. **Database izleme:** Supabase Dashboard → Weekly email
4. **User feedback:** Frontend'e feedback butonu ekle

---

## Son Notlar

🔴 **Acil (1 gün):** Sentry + Rate limiting + Helmet
🟡 **Önemli (1 hafta):** CORS + Request limits + Lisans notu
🟢 **İyileştirme (1 ay):** Monitoring + Alerts + Backup automation

Sorularınız olursa hazırım! 🚀
