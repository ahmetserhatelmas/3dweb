# R2 Worker: GET /file route

`pub-xxx.r2.dev` adresine hem backend (curl) hem tarayıcı bazı ortamlarda TLS hatası veriyor. Bu yüzden dosya stream’i önce **Worker** üzerinden deniyor; Worker R2’ye dahili bağlandığı için TLS sorunu olmaz.

Backend, `R2_WORKER_URL` tanımlıysa şu isteği atar:

```
GET {R2_WORKER_URL}/file?key={encodeURIComponent(file_path)}
```

Örnek: `GET https://kunye-upload-worker.xxx.workers.dev/file?key=temp/1772299133047/1772299133047-jha2qj.step`

## Worker’a eklenecek kod

Mevcut Worker’ında (örn. `kunye-upload-worker`) **upload** dışında aşağıdaki route’u ekle. R2 bucket binding adının `MY_BUCKET` olduğunu varsayıyorum; `wrangler.toml` içindeki binding adına göre değiştir.

```js
// GET /file?key=temp/xxx/file.step  → R2'den dosyayı döndür
if (url.pathname === '/file' && request.method === 'GET') {
  const key = new URL(request.url).searchParams.get('key')
  if (!key) return new Response('Missing key', { status: 400 })
  const object = await env.MY_BUCKET.get(key)  // MY_BUCKET = wrangler.toml'daki binding
  if (!object) return new Response('Not found', { status: 404 })
  const contentType = object.httpMetadata?.contentType || 'application/octet-stream'
  return new Response(object.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600'
    }
  })
}
```

- `env.MY_BUCKET`: `wrangler.toml` içinde tanımlı R2 bucket binding adı (örn. `BUCKET` veya `R2`).
- Bu route’u deploy ettikten sonra backend otomatik olarak önce Worker’dan stream deneyecek; Worker yoksa veya 404 dönerse curl (r2.dev) fallback’e düşer.
