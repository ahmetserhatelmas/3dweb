# Günlük veri yedekleme

Bu projede veri iki yerde tutuluyor:

- **Supabase** – Veritabanı (PostgreSQL): kullanıcılar, projeler, teklifler, checklist vb.
- **Cloudflare R2** – Dosyalar (proje dosyaları)

## 1. Supabase veritabanı yedekleme

### Script ile (önerilen)

Proje kökünden:

```bash
# Sadece yerel klasöre yedek al (backups/YYYY-MM-DD/*.json)
npm run backup

# Yedekleri R2'ye de yükle (backups/db/YYYY-MM-DD/)
npm run backup:r2
```

Yedekler `backups/YYYY-MM-DD/` altında her tablo için bir `tablo_adi.json` ve `_manifest.json` olarak yazılır.

### Günlük otomatik yedek (cron)

Sunucuda veya kendi makinenizde her gün 02:00’te çalışsın isterseniz:

```bash
crontab -e
```

Ekleyin:

```
0 2 * * * cd /path/to/3dweb && npm run backup:r2 >> /var/log/kunye-backup.log 2>&1
```

`/path/to/3dweb` kısmını projenin gerçek yoluna çevirin.

### Railway / Render / GitHub Actions

- **Railway / Render:** “Cron job” veya “Scheduled task” ile günde bir kez `npm run backup:r2` çalıştıracak bir job tanımlayın (backend’in çalıştığı ortamda `.env` ve Node olmalı).
- **GitHub Actions:** `.github/workflows/backup.yml` ile gece bir saatte tetiklenen workflow’da `npm run backup` veya `backup:r2` çalıştırıp artefact veya bir depoya yükleyebilirsiniz.

## 2. Supabase Dashboard yedekleri

- **Pro plan:** Supabase Dashboard → Project Settings → Database → “Backups” bölümünde otomatik yedekler vardır.
- **Ücretsiz plan:** Otomatik yedek yok; yukarıdaki script ile günlük yedek almanız gerekir.

## 3. R2 (dosya) yedekleme

- Proje dosyaları **Cloudflare R2** bucket’ında (`R2_BUCKET_NAME`).
- **Seçenek A:** R2’de bucket için **Object versioning** açın (Dashboard → R2 → bucket → Settings). Silinen/güncellenen objelerin önceki sürümleri saklanır.
- **Seçenek B:** Başka bir bucket veya S3 uyumlu depolamaya periyodik kopyalama yapan bir script/cron ekleyebilirsiniz.

## 4. Geri yükleme

- **Veritabanı:** `backups/YYYY-MM-DD/*.json` dosyaları Supabase’e geri yüklemek için özel bir “restore” scripti veya Supabase SQL/import işlemi gerekir. İhtiyaç olursa ayrı bir restore scripti yazılabilir.
- **R2:** Versioning açıksa R2 Dashboard’dan objenin önceki sürümünü geri alabilirsiniz.

## 5. .env gereksinimleri

- **Sadece `npm run backup`:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` yeterli.
- **`npm run backup:r2`:** Ayrıca `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` tanımlı olmalı.

`backups/` klasörü `.gitignore`’da olmalı; yedek dosyaları repoya commit edilmez.
