# 3D İmalat Teklif ve Proje Yönetim Sistemi
## Ürün ve Hizmet Dokümantasyonu

---

## 1.1. Temel Özellikler

### Ana Özellikler

- **3D STEP Dosyası Görüntüleme**: Tarayıcı içinde STEP formatındaki 3D modelleri görüntüleme
- **Çoklu Tedarikçi Teklif Sistemi**: Bir proje için birden fazla tedarikçiden teklif alma
- **Parça Bazlı Fiyatlandırma**: Her STEP dosyası için ayrı fiyat, adet ve not girişi
- **Hierarchical Checklist Sistemi**: Ana başlıklar ve alt başlıklarla detaylı kontrol listeleri
  - Dosya bazlı checklist'ler (her STEP dosyası için özel)
  - Proje bazlı checklist'ler (genel proje kontrolleri)
- **Otomatik PDF Sözleşme Oluşturma**: Teklif kabulünde otomatik sözleşme PDF'i oluşturma
- **Revizyon Yönetimi**: STEP dosyaları için revizyon takibi (Rev. A, Rev. B, vs.)
- **Proje Durum Takibi**: Pending, Reviewing, Completed durumları
- **Dosya Yönetimi**: PDF, Excel, resim gibi ek dosyaların yüklenmesi
- **Real-time Güncellemeler**: Proje ilerlemesinin anlık takibi
- **Rol Bazlı Yetkilendirme**: Admin, Müşteri, Tedarikçi rolleri
- **Email Onay Sistemi**: Kullanıcı kaydı için email doğrulama

---

## 1.2. Teknik Mimari Özeti

### Frontend Teknolojileri
- **Framework**: React.js 18.x
- **Build Tool**: Vite
- **Routing**: React Router DOM v6
- **Styling**: Custom CSS (global styles + component-based)
- **Icons**: Lucide React
- **3D Viewer**: occt-import-js (Open CASCADE Technology)
- **State Management**: React Context API (AuthContext)

### Backend Teknolojileri
- **Runtime**: Node.js
- **Framework**: Express.js
- **Authentication**: JWT (JSON Web Tokens)
- **API Architecture**: RESTful API

### Database & Storage
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (3 buckets: documents, project-files, step-files)
- **Real-time**: Supabase Real-time subscriptions

### PDF Oluşturma
- **Library**: html-pdf-node
- **Format**: HTML/CSS → PDF conversion
- **Features**: Türkçe karakter desteği, özelleştirilebilir şablonlar

### Deployment
- **Frontend**: Vercel
- **Backend**: Railway/Custom hosting
- **Environment**: Production/Development ortamları

### Güvenlik
- Supabase Row Level Security (RLS) policies
- JWT token validation
- HTTPS encryption
- Environment variables for sensitive data

---

## 1.3. Güvenlik ve Veri Koruma

### Kimlik Doğrulama ve Yetkilendirme

**Authentication Mekanizması:**
- JWT (JSON Web Token) tabanlı authentication
- Secure password hashing (Supabase Auth)
- Email confirmation sistemi
- Session management

**Role-Based Access Control (RBAC):**

**Admin Rolü:**
- Tüm projelere erişim
- Kullanıcı yönetimi
- Sistem ayarları
- Checklist düzenleme yetkisi

**Customer (Müşteri) Rolü:**
- Kendi projelerini oluşturma ve görüntüleme
- Tedarikçi seçimi
- Teklif değerlendirme ve kabul etme
- Proje ilerlemesini takip etme (sadece görüntüleme)
- Checklist'leri görüntüleme (düzenleme yok)

**User/Supplier (Tedarikçi) Rolü:**
- Atanan projelere erişim
- Teklif verme
- Kabul edilen projelerde checklist doldurma
- Revizyon dosyaları yükleme
- STEP dosyalarını görüntüleme

### Veri Güvenliği

**Row Level Security (RLS):**
- Her kullanıcı sadece yetkili olduğu verilere erişebilir
- Database seviyesinde erişim kontrolü
- Supabase policy'leri ile korunan tablolar

**File Security:**
- Dosya sahipliği kontrolü
- Bucket-level permissions
- Secure file upload/download

**Data Protection:**
- SQL injection koruması (Supabase prepared statements)
- XSS koruması (React'in built-in koruması)
- CSRF token validation

### İletişim Güvenliği
- HTTPS/TLS şifrelemesi (tüm API çağrıları)
- Secure cookie handling
- CORS policy implementation

### Veri Yedekleme
- Supabase otomatik günlük yedekleme
- Point-in-time recovery
- Manual backup seçenekleri

### Gizlilik
- Şifre ve hassas veriler environment variables'da saklanır
- Supabase Service Role Key sadece backend'de kullanılır
- Client-side'da public key kullanımı
- Password'ler hiçbir zaman plain text olarak saklanmaz

---

## 1.4. Entegrasyon Yetenekleri

### Mevcut Entegrasyonlar

**1. Supabase Platform Entegrasyonu**
- Database (PostgreSQL)
- Authentication & User Management
- Storage (File uploads)
- Real-time subscriptions

**2. Email Servisi**
- Supabase Email (email confirmation)
- Custom SMTP konfigürasyonu desteği

**3. 3D Model Format Desteği**
- STEP (.step, .stp) dosyaları
- OCCT (Open CASCADE) kütüphanesi ile parser

### Gelecek Entegrasyon Potansiyeli

**1. Ek 3D Format Desteği**
- STL, OBJ, IGES formatları
- GLTF/GLB web-friendly formatlar
- DWG/DXF 2D çizimler

**2. ERP Sistemleri**
- SAP, Oracle ERP entegrasyonu
- Custom ERP API connections
- Data synchronization

**3. CRM Sistemleri**
- Müşteri takibi ve iletişim
- Sales pipeline entegrasyonu
- Contact management

**4. Ödeme Gateway'leri**
- Stripe, PayPal entegrasyonu
- Invoice sistemi
- Online ödeme modülü

**5. Bildirim Servisleri**
- Browser push notifications
- SMS bildirimleri (Twilio)
- Slack, Discord webhook'ları
- Email notifications (genişletilmiş)

**6. CAD Yazılımları**
- SolidWorks, AutoCAD export eklentileri
- Direct CAD import
- Batch processing

**7. Analitik ve Raporlama**
- Google Analytics
- Custom dashboard'lar
- Export to Excel/PDF
- Business intelligence tools

---

## 1.5. Kullanıcı Akışı

### MÜŞTERI (Customer) Akışı

**1. Kayıt ve Giriş**
- Email ile kayıt
- Email doğrulama linki
- Giriş yapma
- Dashboard'a yönlendirilme

**2. Proje Oluşturma**
- "Yeni Proje" butonu
- Proje bilgileri girişi:
  - Proje adı
  - Parça numarası (opsiyonel)
  - Termin tarihi
- Tedarikçi seçimi (çoklu seçim)
- STEP dosyası yükleme
- Ek dosyalar yükleme (PDF, Excel, resim)
- Proje oluşturma

**3. Teklif Bekleme**
- Gelen teklifleri görüntüleme
- Her tedarikçinin:
  - Parça bazlı fiyatlarını görme
  - Toplam fiyatı görme
  - Termin tarihini görme
  - Tedarikçi notlarını okuma

**4. Teklif Değerlendirme ve Kabul**
- Teklifleri karşılaştırma
- Fiyat detaylarını inceleme
- Bir teklifi kabul etme
- Otomatik PDF sözleşmesi oluşturulması
- Projenin kabul edilen tedarikçiye atanması

**5. Proje Takibi**
- Proje durumunu görüntüleme:
  - Pending (Beklemede)
  - Reviewing (İncelemede)
  - Completed (Tamamlandı)
- Checklist ilerlemesini takip etme (sadece görüntüleme)
- Revizyon dosyalarını inceleme
- Sözleşme PDF'ini indirme
- Proje dosyalarına erişim

---

### TEDARİKÇİ (User/Supplier) Akışı

**1. Kayıt ve Giriş**
- Email ile kayıt
- Email doğrulama
- Giriş yapma
- Dashboard'a yönlendirilme

**2. Teklif Davetlerini Görme**
- "Teklifler" listesinde bekleyen projeler
- Proje detaylarını görüntüleme
- Termin tarihlerini kontrol etme

**3. STEP Dosyası İnceleme**
- 3D viewer'da STEP dosyasını görüntüleme
- Zoom, rotate, pan işlemleri
- Dosya kontrolü checklist'ini görüntüleme (önizleme)
- Proje gereksinimlerini anlama

**4. Teklif Verme**
- Her STEP dosyası için:
  - Birim fiyat girişi (₺)
  - Adet belirleme
  - Özel notlar ekleme
- Ekstra kalemler ekleme:
  - Aksesuar
  - Montaj
  - Nakliye vb.
- Termin tarihi belirleme
- Toplam fiyatı görme
- Teklifi gönderme

**5. Teklif Kabul Edildikten Sonra**
- Projeye tam erişim
- STEP dosyalarını görüntüleme
- **Dosya Kontrolü Checklist'i Doldurma**:
  - Ana başlıkları görme (Üretim Hazırlık, Planlama, Üretim, Kalite Kontrol)
  - Alt başlıkları işaretleme
  - Her STEP dosyası için özel checklist
  - Parent item tamamlanması için tüm children'ın işaretlenmesi gerekir
- **Proje Kontrol Listesi Doldurma**:
  - Genel proje kontrol adımları
  - Sözleşme ve teknik mütabakat
  - Üretim
  - Kalite kontrol
  - Teslimat
  - Kabul
- İlerleme durumunu güncelleme
- Revizyon dosyaları yükleme:
  - Rev. A → Rev. B → Rev. C
  - Her revizyon için yeni STEP dosyası

**6. Proje Tamamlama**
- Tüm checklist'leri tamamlama
- Final kontrollerini yapma
- Proje durumunu "Completed" olarak işaretleme

---

### ADMİN Akışı

**1. Tam Yetki Erişimi**
- Tüm projeleri görüntüleme
- Tüm kullanıcıları görüntüleme ve yönetme
- Sistem ayarlarına erişim

**2. Kullanıcı Yönetimi**
- Yeni kullanıcı ekleme
- Kullanıcı rollerini değiştirme (Admin/Customer/User)
- Kullanıcı bilgilerini güncelleme
- Kullanıcı silme/devre dışı bırakma

**3. Proje Yönetimi**
- Herhangi bir projeye erişim
- Proje durumlarını değiştirme
- Checklist'leri düzenleme ve güncelleme
- Proje silme/arşivleme
- Tedarikçi ataması değiştirme

**4. Sistem İzleme**
- Genel sistem durumunu kontrol etme
- Log'ları inceleme
- Sorunları tespit etme ve düzeltme
- Database yönetimi

---

## 1.6. Fiyatlandırma ile Özellik Eşleşmesi

### Önerilen Fiyatlandırma Modeli (SaaS)

#### 1. BASIC Plan (Ücretsiz / Demo)
**Aylık: ₺0**

**Özellikler:**
- Maksimum 3 proje
- Maksimum 2 tedarikçi
- Temel checklist özellikleri
- STEP viewer (basic)
- 1 GB storage
- Community support (forum)

**Hedef Kitle:** Küçük işletmeler, freelancerlar, sistem tanıma

---

#### 2. PROFESSIONAL Plan
**Aylık: ₺999 / Yıllık: ₺9,990 (%17 indirim)**

**Özellikler:**
- ✅ Sınırsız proje
- ✅ Sınırsız tedarikçi
- ✅ Hierarchical checklist (ana/alt başlık)
- ✅ PDF sözleşme oluşturma (otomatik)
- ✅ Revizyon yönetimi (A, B, C, ...)
- ✅ Advanced STEP viewer
- ✅ 10 GB storage
- ✅ Email support (24 saat yanıt)
- ✅ Export to Excel/PDF

**Hedef Kitle:** Orta ölçekli imalat firmaları, tedarikçi ağı olan şirketler

---

#### 3. ENTERPRISE Plan
**Aylık: ₺2,999 / Yıllık: ₺29,990 (%17 indirim)**

**Professional özellikleri + aşağıdakiler:**
- ✅ Özel domain (your-company.example.com)
- ✅ API access (RESTful API)
- ✅ Öncelikli support (8 saat yanıt)
- ✅ 100 GB storage
- ✅ Custom branding (logo, renkler)
- ✅ SLA garantisi (%99.9 uptime)
- ✅ Dedicated account manager
- ✅ Advanced analytics & reporting
- ✅ Multi-language support
- ✅ SSO (Single Sign-On) entegrasyonu

**Hedef Kitle:** Büyük ölçekli imalat şirketleri, holding yapıları

---

#### 4. CUSTOM Plan
**Anlaşmalı Fiyat**

**Enterprise özellikleri + aşağıdakiler:**
- ✅ On-premise deployment
- ✅ Özel özellik geliştirme
- ✅ ERP/CRM entegrasyonu
- ✅ Unlimited storage
- ✅ Dedicated server
- ✅ 7/24 support (telefon + email)
- ✅ Özel eğitim ve onboarding
- ✅ Custom SLA
- ✅ White-label solution

**Hedef Kitle:** Kurumsal müşteriler, özel gereksinimler olan firmalar

---

### Özellik Karşılaştırma Tablosu

| Özellik | Basic | Professional | Enterprise | Custom |
|---------|-------|-------------|-----------|--------|
| **Proje Sayısı** | 3 | ∞ | ∞ | ∞ |
| **Tedarikçi Sayısı** | 2 | ∞ | ∞ | ∞ |
| **Kullanıcı Sayısı** | 2 | 10 | 50 | ∞ |
| **STEP Viewer** | Basic | Advanced | Advanced | Advanced |
| **Hierarchical Checklist** | ✗ | ✓ | ✓ | ✓ |
| **PDF Sözleşme** | ✗ | ✓ | ✓ | ✓ |
| **Revizyon Yönetimi** | ✗ | ✓ | ✓ | ✓ |
| **Storage** | 1 GB | 10 GB | 100 GB | Sınırsız |
| **API Access** | ✗ | ✗ | ✓ | ✓ |
| **Custom Branding** | ✗ | ✗ | ✓ | ✓ |
| **SSO Integration** | ✗ | ✗ | ✓ | ✓ |
| **On-Premise** | ✗ | ✗ | ✗ | ✓ |
| **Support** | Forum | Email (24h) | Priority (8h) | 7/24 |
| **SLA** | ✗ | ✗ | 99.9% | Custom |
| **Account Manager** | ✗ | ✗ | ✓ | ✓ |

---

## 1.7. Rakiplerden Görülenler

### Rakip Analizi ve Kıyaslamalar

#### 1. Traditional CAD Viewer Sistemleri

**Örnekler:**
- Autodesk Viewer
- SolidWorks eDrawings
- CATIA WebGL Viewer

**Güçlü Yönleri:**
- Gelişmiş 3D görselleştirme
- Birçok format desteği (STEP, IGES, STL, DWG, vs.)
- Measurement tools
- Section views, exploded views

**Zayıf Yönleri:**
- Teklif yönetimi sistemleri yok
- Proje yönetimi entegrasyonu zayıf
- Pahalı lisanslar ($1,000+/yıl)
- Desktop aplikasyon gerektiriyor (bazıları)
- Tedarikçi işbirliği özellikleri yok

**Bizim Avantajımız:**
- ✅ Entegre teklif sistemi
- ✅ Web tabanlı, kurulum yok
- ✅ Ekonomik fiyatlandırma
- ✅ Checklist ve proje takibi

---

#### 2. Generic Project Management Tools

**Örnekler:**
- Trello
- Asana
- Monday.com
- ClickUp

**Güçlü Yönleri:**
- Genel amaçlı, esnek yapı
- Task management
- Collaboration features
- Entegrasyon seçenekleri çok

**Zayıf Yönleri:**
- İmalat/teklif süreçlerine özel değil
- 3D görüntüleme yok
- Teklif karşılaştırması yok
- Revizyon yönetimi zayıf
- CAD dosya desteği yok

**Bizim Avantajımız:**
- ✅ İmalat sektörüne özel
- ✅ STEP viewer entegresi
- ✅ Teklif karşılaştırma
- ✅ Hierarchical checklist
- ✅ Otomatik sözleşme

---

#### 3. Manufacturing Quotation Platforms

**Örnekler:**
- Xometry
- Protolabs
- Hubs (3D Hubs)
- Factorem

**Güçlü Yönleri:**
- Otomatik fiyatlandırma (AI-powered)
- Geniş tedarikçi ağı (marketplace model)
- Instant quote
- Kalite garantisi

**Zayıf Yönleri:**
- Detaylı checklist yok
- Revizyon takibi zayıf
- Kendi tedarikçilerinizi kullanamazsınız
- Yüksek komisyonlar
- Özelleştirme seçenekleri sınırlı
- White-label çözüm yok

**Bizim Avantajımız:**
- ✅ Hierarchical checklist sistemi
- ✅ Revizyon yönetimi (A, B, C)
- ✅ Kendi tedarikçilerinizle çalışma
- ✅ Komisyon yok
- ✅ Özelleştirilebilir
- ✅ White-label potansiyeli

---

#### 4. ERP Sistemleri

**Örnekler:**
- SAP
- Oracle ERP
- Microsoft Dynamics
- Odoo

**Güçlü Yönleri:**
- Kapsamlı iş süreçleri yönetimi
- Muhasebe, stok, üretim entegrasyonu
- Raporlama ve analitik
- Enterprise-grade

**Zayıf Yönleri:**
- Çok karmaşık ve ağır
- Çok pahalı ($50,000+/yıl)
- 3D görüntüleme yok
- Uzun implementation süresi (6-12 ay)
- Ağır eğitim gereksinimi
- SME'ler için overkill

**Bizim Avantajımız:**
- ✅ Kullanım kolaylığı
- ✅ Hızlı setup (1 gün)
- ✅ Ekonomik (₺999-2,999/ay)
- ✅ STEP viewer entegresi
- ✅ Spesifik kullanım senaryosu
- ✅ Minimal öğrenme eğrisi

---

### Farklılaşma Noktalarımız

#### 🎯 Unique Value Propositions

1. **3D + Teklif Kombinasyonu**
   - STEP görüntüleme + Teklif sistemi tek platformda
   - Tedarikçiler 3D modeli görüp doğru teklif verebilir

2. **Hierarchical Checklist**
   - Ana başlık / alt başlık yapısı
   - Dosya bazlı + Proje bazlı checklist'ler
   - Otomasyon (parent-child ilişkisi)

3. **Otomatik Sözleşme**
   - Teklif kabulünde PDF sözleşme oluşturma
   - Türkçe karakter desteği
   - Yasal geçerlilik

4. **Revizyon Sistemi**
   - Rev. A, Rev. B, Rev. C yapısı
   - Revizyon geçmişi
   - Eski revizyonlara erişim

5. **Uygun Fiyat**
   - ₺999'dan başlayan fiyatlar
   - ERP'lerin 1/50'si fiyata
   - SME friendly

6. **Türkçe Dil Desteği**
   - Tam Türkçe arayüz
   - Türkçe dokümantasyon
   - Yerel destek

7. **Kurulum Kolaylığı**
   - Web tabanlı, kurulum yok
   - 5 dakikada başlangıç
   - Minimal eğitim

---

### Pazar Konumlandırma

**Hedef Pazar:**
- Türkiye'deki küçük-orta ölçekli imalat firmaları
- 5-50 kişilik tedarikçi ağı olan şirketler
- CNC, metal işleme, plastik enjeksiyon firmaları
- Mühendislik büroları

**Pazar Büyüklüğü (Türkiye):**
- ~50,000 imalat firması
- Potansiyel müşteri: ~5,000 firma
- TAM (Total Addressable Market): ~₺600M/yıl
- SAM (Serviceable Available Market): ~₺100M/yıl

---

## 1.8. Blog Sayfası

### Blog İçerik Stratejisi

#### Blog Kategorileri

**1. Ürün Güncellemeleri**
- Yeni özellik duyuruları
- Version release notları
- Roadmap paylaşımları
- Beta feature'lar

**Amaç:** Kullanıcıları güncel tutmak, yeni özellikleri tanıtmak

---

**2. Kullanım Kılavuzları (How-To)**
- "STEP dosyası nasıl yüklenir?"
- "Teklif karşılaştırması nasıl yapılır?"
- "Checklist sistemi kullanım rehberi"
- "Revizyon yönetimi adım adım"
- Video tutoriallar

**Amaç:** Kullanıcı onboarding, self-service support

---

**3. Sektör İçerikleri**
- İmalat sektöründe dijital dönüşüm
- CNC işleme süreçleri
- 3D modelleme best practices
- Tedarikçi yönetimi stratejileri
- Kalite kontrol prosedürleri

**Amaç:** Thought leadership, SEO, sektör otoritesi

---

**4. Müşteri Hikayeleri**
- Case study'ler (başarı hikayeleri)
- Müşteri röportajları
- Problem-çözüm hikayeleri
- ROI hesaplamaları

**Amaç:** Social proof, trust building, conversion

---

**5. Teknik Makaleler**
- "STEP dosya formatı nedir?"
- "CAD sistemleri karşılaştırması"
- "Web tabanlı 3D görüntüleme teknolojileri"
- "API entegrasyonları"

**Amaç:** SEO, technical audience'a hitap etme

---

### Örnek Blog Başlıkları (30 adet)

**Ürün Güncellemeleri:**
1. "Yeni Özellik: Hierarchical Checklist Sistemi"
2. "Otomatik PDF Sözleşme Artık Hazır!"
3. "Revizyon Yönetimi ile Değişiklikleri Takip Edin"
4. "2024 Q1 Roadmap: Neler Geliyor?"

**Kullanım Kılavuzları:**
5. "5 Dakikada İlk Projenizi Oluşturun"
6. "STEP Dosyası Yükleme Rehberi (Video)"
7. "Teklif Karşılaştırması: Adım Adım Kılavuz"
8. "Checklist Sistemini Verimli Kullanmanın 7 İpucu"
9. "Revizyon Nasıl Oluşturulur?"

**Sektör İçerikleri:**
10. "İmalat Sektöründe Teklif Sürecini %50 Hızlandıran 5 Yöntem"
11. "Tedarikçi Yönetiminde Yapılan 10 Hata"
12. "CNC Imalatta Kalite Kontrol Listesi"
13. "Dijital Dönüşüm: İmalat 4.0'a Hazır mısınız?"
14. "Tedarikçi Seçiminde Dikkat Edilmesi Gereken 7 Kriter"
15. "Üretimde Verimliliği Artırmanın 8 Yolu"

**Teknik Makaleler:**
16. "STEP Dosyası Nedir ve Neden Önemlidir?"
17. "CAD Formatları Karşılaştırması: STEP vs IGES vs STL"
18. "Web Tabanlı 3D Görüntüleme Nasıl Çalışır?"
19. "Revizyon Yönetimi: A'dan Z'ye Kapsamlı Rehber"
20. "RESTful API ile Entegrasyon Rehberi"
21. "Supabase vs Firebase: Hangisi Daha İyi?"

**Müşteri Hikayeleri:**
22. "ABC Metal: Teklif Süresini 2 Günden 2 Saate Düşürdü"
23. "XYZ Mühendislik Nasıl 20 Tedarikçiyi Tek Platformda Yönetiyor?"
24. "Başarı Hikayesi: %30 Maliyet Tasarrufu"
25. "Case Study: 100 Projenin Dijital Dönüşümü"

**Trend ve Öngörüler:**
26. "2024'te İmalat Sektöründe 5 Büyük Trend"
27. "Yapay Zeka İmalatyı Nasıl Değiştirecek?"
28. "Endüstri 5.0: İnsanlar ve Makineler Birlikte"
29. "Remote Working: Tedarikçi İlişkilerinin Geleceği"

**Karşılaştırma:**
30. "ERP vs Özel Teklif Sistemi: Hangisi Sizin İçin?"

---

### SEO Stratejisi

**Primary Keywords:**
- "imalat teklif sistemi"
- "STEP dosyası görüntüleme"
- "üretim proje yönetimi"
- "tedarikçi teklif karşılaştırma"
- "3D model teklif"

**Long-tail Keywords:**
- "cnc teklif nasıl verilir"
- "step dosyası nedir nasıl açılır"
- "tedarikçi yönetim sistemi fiyatları"
- "imalat için proje takip programı"
- "3d model üzerinden fiyat alma"

**Local SEO:**
- Türkiye odaklı içerik
- Şehir bazlı içerikler (İstanbul, Ankara, İzmir, Bursa)
- Organize sanayi bölgeleri referansları

**Technical SEO:**
- Fast loading (< 2 saniye)
- Mobile-friendly
- Schema markup
- SSL certificate
- Sitemap ve robots.txt

---

### İçerik Yayın Takvimi

**Haftalık Plan:**
- Pazartesi: Ürün güncellemesi veya sektör içeriği
- Çarşamba: Kullanım kılavuzu (how-to)
- Cuma: Teknik makale veya müşteri hikayesi

**Aylık:**
- 4 ürün güncellemesi
- 4 kullanım kılavuzu
- 4 sektör içeriği
- 2 müşteri hikayesi
- 2 teknik makale

**Toplam:** 16 blog yazısı/ay

---

## Ek Bilgiler

### Sistem Gereksinimleri

**Frontend (Kullanıcı):**
- Modern web tarayıcı (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- JavaScript aktif
- Internet bağlantısı (min 2 Mbps)
- Ekran çözünürlüğü: min 1280x720

**Backend (Hosting):**
- Node.js 18.x veya üzeri
- 2 GB RAM (minimum)
- 10 GB disk alanı
- HTTPS sertifikası

---

### Destek ve İletişim

**Support Channels:**
- Email: support@example.com
- Forum: community.example.com (Basic plan)
- Priority Support: enterprise@example.com (Enterprise plan)
- Phone: +90 xxx xxx xx xx (Custom plan)

**Support Saatleri:**
- Email: 7/24 ticket açılabilir, yanıt süreleri:
  - Basic: 48 saat
  - Professional: 24 saat
  - Enterprise: 8 saat
  - Custom: 2 saat
- Telefon: Sadece Custom plan, 7/24

---

### Lisans ve Kullanım Şartları

- SaaS (Software as a Service) modeli
- Aylık veya yıllık abonelik
- Kullanıcı başına veya şirket bazlı lisanslama
- Otomatik yenileme (iptal edilene kadar)
- 30 gün para iade garantisi (ilk ay)
- Ücretsiz deneme: 14 gün (kredi kartı gerektirmez)

---

### Güncellemeler ve Yol Haritası

**Önümüzdeki 3 Ay:**
- [ ] Mobile app (iOS/Android)
- [ ] Gelişmiş analitik dashboard
- [ ] Toplu email bildirimleri
- [ ] Excel export geliştirmeleri

**6 Ay:**
- [ ] API v2 (GraphQL)
- [ ] STL format desteği
- [ ] Otomatik fiyat tahminleme (AI)
- [ ] Çoklu dil desteği (İngilizce)

**12 Ay:**
- [ ] ERP entegrasyon modülü
- [ ] Marketplace özelliği
- [ ] Blockchain tabanlı sözleşme
- [ ] AR/VR model görüntüleme

---

**Son Güncelleme:** 30 Ocak 2026
**Versiyon:** 1.0
**Hazırlayan:** 3D İmalat Teklif Sistemi Ekibi
