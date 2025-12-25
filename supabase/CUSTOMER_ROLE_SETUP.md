# Müşteri Rolü Ekleme - Kurulum Kılavuzu

## Yapılan Değişiklikler

### 1. **Database Schema**
- `profiles` tablosuna `customer` rolü eklendi
- `profiles` tablosuna `created_by` kolonu eklendi (müşterinin hangi admin tarafından oluşturulduğunu takip eder)
- Tüm RLS (Row Level Security) policy'leri customer desteği için güncellendi

### 2. **Backend (API)**
- **auth.js**: 
  - Customer'lar sadece tedarikçi (user) oluşturabilir
  - `/api/auth/suppliers` endpoint'i customer'ların sadece kendi oluşturdukları tedarikçileri görmesini sağlar
  - `/api/auth/users` endpoint'i customer'ların sadece kendi oluşturdukları kullanıcıları görmesini sağlar

- **projects.js**:
  - Customer'lar sadece kendi oluşturdukları projeleri görebilir
  - Customer'lar proje oluşturabilir, güncelleyebilir ve silebilir (sadece kendi projelerinde)
  - Middleware'e `requireAdminOrCustomer` eklendi

### 3. **Frontend**
- **CustomerDashboard.jsx**: Müşteriler için özel dashboard sayfası
- **App.jsx**: Customer route'ları eklendi (`/customer`, `/customer/users`, `/customer/new-project`)
- **Users.jsx**: Admin ve customer için dinamik hale getirildi
  - Customer sadece "Tedarikçi" oluşturabilir
  - Admin tüm rolleri oluşturabilir
- **NewProject.jsx**: Admin ve customer için dinamik hale getirildi
- **CSS**: Customer rolü için mor renk teması eklendi

## Veritabanı Migration

Mevcut veritabanınızı güncellemek için:

```bash
# Supabase SQL Editor'de şu dosyayı çalıştırın:
supabase/migration-customer-role.sql
```

## Müşteri Rolü Nasıl Kullanılır?

### 1. Müşteri Oluşturma (Admin tarafından)
- Admin paneline giriş yapın
- "Kullanıcılar" sayfasına gidin
- "Yeni Kullanıcı" butonuna tıklayın
- Rol olarak "Müşteri" seçin
- Müşteri bilgilerini girin ve kaydedin

### 2. Müşteri Paneli
Müşteri olarak giriş yaptığınızda:
- `/customer` - Kendi oluşturduğunuz projeleri görürsünüz
- `/customer/users` - Kendi oluşturduğunuz tedarikçileri görürsünüz
- `/customer/new-project` - Yeni proje oluşturabilirsiniz

### 3. Hiyerarşi
```
Admin
├── Tüm projeleri görebilir
├── Tüm kullanıcıları görebilir
├── Müşteri oluşturabilir
└── Tedarikçi oluşturabilir

Customer (Müşteri)
├── Kendi projelerini görebilir
├── Kendi tedarikçilerini görebilir
├── Tedarikçi oluşturabilir
└── Tedarikçilerine proje atayabilir

User (Tedarikçi)
└── Kendine atanan projeleri görebilir
```

## Renk Temaları

- **Admin**: Yeşil (#00d4aa)
- **Customer**: Mor (#a78bfa)
- **User (Tedarikçi)**: Mavi (#0ea5e9)

## Test Senaryoları

### Senaryo 1: Müşteri Tedarikçi Oluşturur
1. Admin ile giriş yap
2. Yeni müşteri oluştur (email: musteri@firma.com)
3. Çıkış yap ve müşteri olarak giriş yap
4. "Tedarikçiler" sayfasına git
5. Yeni tedarikçi oluştur (email: tedarikci1@firma.com)
6. Tedarikçinin listede göründüğünü doğrula

### Senaryo 2: Müşteri Proje Oluşturur
1. Müşteri olarak giriş yap
2. "Projeler" sayfasından "Yeni Proje" tıkla
3. Proje detaylarını gir
4. Tedarikçi dropdown'unda sadece kendi oluşturduğun tedarikçileri gör
5. Projeyi oluştur ve listede göründüğünü doğrula

### Senaryo 3: İzolasyon Kontrolü
1. Admin ile 2 müşteri oluştur (musteri1, musteri2)
2. musteri1 ile giriş yap ve tedarikci1 oluştur
3. Çıkış yap
4. musteri2 ile giriş yap ve tedarikci2 oluştur
5. musteri2'nin tedarikçiler listesinde sadece tedarikci2'yi görebildiğini doğrula
6. musteri1'in tedarikçi listesinde sadece tedarikci1'i görebildiğini doğrula

## Önemli Notlar

- Müşteriler asla başka müşteri veya admin oluşturamaz
- Her müşteri sadece kendi oluşturduğu tedarikçileri ve projeleri görebilir
- Database RLS policy'leri ile veri güvenliği sağlanmıştır
- Backend API endpoint'leri de ek kontroller ile korunmuştur

## Rollback

Eğer bu değişiklikleri geri almak isterseniz:

```sql
-- profiles tablosundan customer rolünü kaldır
ALTER TABLE public.profiles 
  DROP CONSTRAINT profiles_role_check;

ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'user'));

-- created_by kolonunu kaldır
ALTER TABLE public.profiles 
  DROP COLUMN created_by;

-- Eski policy'leri geri yükleyin (schema.sql'den)
```





