# Supabase Kurulum Rehberi

## 1. Supabase Projesi Oluştur

1. [supabase.com](https://supabase.com) adresine git
2. "Start your project" ile yeni proje oluştur
3. Proje adı ve şifre belirle
4. Region olarak en yakın lokasyonu seç (eu-central-1 önerilir)

## 2. Veritabanı Şemasını Kur

1. Supabase Dashboard'a git
2. Sol menüden **SQL Editor** seç
3. **New Query** butonuna tıkla
4. `supabase/schema.sql` dosyasının içeriğini yapıştır
5. **Run** butonuna tıkla

## 3. Storage Bucket'larını Oluştur

1. Sol menüden **Storage** seç
2. **New bucket** butonuna tıkla
3. İki bucket oluştur:
   - `step-files` (Public: OFF)
   - `documents` (Public: OFF)

## 4. API Anahtarlarını Al

1. Sol menüden **Settings** > **API** seç
2. Şu değerleri kopyala:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

## 5. .env Dosyasını Oluştur

Proje kök dizininde `.env` dosyası oluştur:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PORT=3001
```

Frontend için (opsiyonel, real-time için):
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 6. Kullanıcıları Oluştur

### Yöntem 1: Supabase Dashboard
1. **Authentication** > **Users** seç
2. **Add user** > **Create new user**
3. Email ve şifre gir
4. User metadata'ya ekle:
   ```json
   {
     "username": "admin",
     "role": "admin",
     "company_name": "TUSAŞ Mühendislik"
   }
   ```

### Yöntem 2: API ile (Backend çalışırken)
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123",
    "username": "admin",
    "role": "admin",
    "company_name": "TUSAŞ Mühendislik"
  }'
```

## 7. Örnek Kullanıcılar

| Rol | Email | Şifre | Company |
|-----|-------|-------|---------|
| Admin | admin@example.com | admin123 | TUSAŞ Mühendislik |
| User | tedarikci@example.com | user123 | ABC Makina Ltd. |

## 8. Uygulamayı Başlat

```bash
# Bağımlılıkları güncelle
npm install

# Uygulamayı başlat
npm run dev
```

## Sorun Giderme

### "Missing Supabase credentials" hatası
- `.env` dosyasının proje kök dizininde olduğundan emin ol
- Değerlerin doğru kopyalandığını kontrol et

### "User not found" hatası
- Kullanıcının Supabase'de oluşturulduğundan emin ol
- Email doğrulamasının yapıldığından emin ol (veya email_confirm: true ile oluştur)

### Storage upload hatası
- Bucket'ların oluşturulduğunu kontrol et
- Storage policies'in SQL'de çalıştırıldığını kontrol et






