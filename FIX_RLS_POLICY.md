# 🚨 ACİL: Profiles RLS Policy Hatası - Çözüm

## Problem
```
Error: new row violates row-level security policy for table "profiles"
```

Backend, kullanıcı kaydı sırasında `profiles` tablosuna insert yapamıyor çünkü RLS policy'leri eksik.

---

## ✅ ÇÖZÜM: Supabase'de Migration Çalıştır

### Adım 1: Supabase Dashboard'u Aç

1. https://supabase.com/dashboard
2. **Project: bdfkpdjsbaejdgozqquu** seç
3. Sol menüden **SQL Editor** tıkla

### Adım 2: Migration SQL'i Çalıştır

**New Query** butonuna tıkla ve şu SQL'i yapıştır:

```sql
-- Fix Profiles RLS Policies

-- Enable RLS (if not already)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can do everything" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- Policy 1: View profiles
CREATE POLICY "Users can view profiles" ON profiles
  FOR SELECT USING (
    auth.uid() = id OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Policy 2: Insert profiles (Service role bypass)
CREATE POLICY "Service role can insert profiles" ON profiles
  FOR INSERT WITH CHECK (true);

-- Policy 3: Update own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (
    auth.uid() = id OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Policy 4: Delete profiles (admin only)
CREATE POLICY "Admins can delete profiles" ON profiles
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Verify
SELECT 'RLS policies created!' as message;
```

### Adım 3: RUN Butonuna Tıkla

- ✅ Success mesajı görmelisin
- "RLS policies created!" yazmalı

---

## Alternatif: Supabase Dashboard UI'dan

1. **Table Editor** → **profiles** tablosu
2. Sağ üst **RLS** toggle'ını kontrol et (açık olmalı)
3. **RLS Policies** bölümüne git
4. **New Policy** butonuna tıkla
5. Manuel olarak policy'leri ekle

---

## Test

Migration'dan sonra:

### 1. Server'ı Yeniden Başlat
```bash
pkill -f "node backend/server.js"
npm run dev
```

### 2. Kayıt Ol
```
http://localhost:5173
→ Kayıt Ol
→ Email, username, şifre gir
→ ✅ Başarılı olmalı (RLS hatası yok)
```

### 3. Log Kontrolü
Terminal'de:
```
✅ Auth user created: { user_id: 'uuid-here' }
✅ Profile created successfully
✅ Auth successful
```

---

## Neden Bu Oldu?

**Problem:** `migration-new-user-system-fixed.sql` dosyasında `profiles` tablosu için RLS policy'leri eksikti. Sadece `supplier_customer_relationships` tablosu için vardı.

**Çözüm:** 
1. `supabaseAdmin` service role key kullanıyor ✅
2. Service role RLS'i bypass etmeli ✅
3. AMA Supabase'in yeni versiyonlarında INSERT için explicit policy gerekiyor ❌

**Fix:** `WITH CHECK (true)` policy'si service role'ün INSERT yapmasına izin veriyor.

---

## Doğrulama

Migration başarılı olduysa:

```sql
-- Supabase SQL Editor'de çalıştır
SELECT 
  policyname,
  cmd as operation,
  CASE 
    WHEN qual IS NOT NULL THEN 'USING: ' || qual
    ELSE ''
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check
    ELSE ''
  END as check_clause
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY cmd;
```

**Beklenen sonuç:**
```
policyname                          | operation | using_clause | check_clause
------------------------------------|-----------|--------------|-------------
Users can view profiles             | SELECT    | (...)        | 
Service role can insert profiles    | INSERT    |              | WITH CHECK: true
Users can update own profile        | UPDATE    | (...)        | 
Admins can delete profiles          | DELETE    | (...)        |
```

---

## ❗ Hala Çalışmıyorsa

### Kontrol 1: Service Role Key Doğru mu?

`.env` dosyasında:
```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Supabase Dashboard → Settings → API → `service_role` key

### Kontrol 2: RLS Açık mı?

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'profiles';
```

`rowsecurity` = `true` olmalı

### Kontrol 3: Backend Log

```
Profile create error: {
  code: '42501',
  message: 'new row violates row-level security policy for table "profiles"'
}
```

Eğer hala bu hatayı alıyorsan:
1. Migration'ı tekrar çalıştır
2. Browser cache temizle
3. Server'ı tamamen durdur ve yeniden başlat

---

## Son Çare: RLS'i Geçici Kapat (SADECE TEST İÇİN)

```sql
-- ⚠️ SADECE LOCAL TEST İÇİN - PRODUCTION'DA YAPMA
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
```

Bu çalışırsa RLS policy'lerinde problem var demektir.

---

**TLDR:** 
1. Supabase SQL Editor'ı aç
2. `migration-fix-profiles-rls.sql` içeriğini yapıştır
3. RUN
4. Server'ı yeniden başlat
5. Kayıt ol - çalışmalı! ✅
