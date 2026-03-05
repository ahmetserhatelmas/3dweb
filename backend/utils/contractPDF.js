import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOGO_PATH = path.resolve(__dirname, '../../public/LOGO.png')

/**
 * KÜNYE Dijital Tedarik Platformu – Sipariş Emri (Purchase Order) PDF
 * Şablon: Kunye_PO_Sablonu.pdf
 */
export async function generateContractPDF(contractData) {
  const {
    projectName,
    projectPartNumber,
    customerName,
    customerCompany,
    customerEmail,
    customerAddress,
    customerTaxOffice,
    customerTaxNumber,
    customerPhone,
    supplierName,
    supplierCompany,
    supplierEmail,
    supplierAddress,
    supplierTaxOffice,
    supplierTaxNumber,
    supplierPhone,
    quotationItems,
    totalPrice,
    deliveryDate,
    contractDate,
    projectId,
    paymentDueDate
  } = contractData

  // PO Number oluştur
  const now = new Date()
  const year = now.getFullYear()
  const seq = String(projectId || '0000').replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase()
  const poNumber = `PO-${year}-${seq}`
  const verifyUrl = `https://kunye.tech/verify/${poNumber}`

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        info: {
          Title: `Siparis Emri – ${T(projectName)}`,
          Author: 'Kunye.tech',
          Subject: 'Purchase Order / Siparis Emri'
        }
      })

      const buffers = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', reject)

      // ─── Renk Paleti ───────────────────────────────────────
  const C = {
    primary:   '#00d4aa',
    dark:      '#0a0e27',
    darkAlt:   '#111828',
    border:    '#1e2a45',
    text:      '#1a1a2e',
    muted:     '#a0aec0',   // daha açık gri — dark bg'de okunabilir
    white:     '#ffffff',
    headerBg:  '#0d1535',
    rowAlt:    '#f8fafc',
    rowNorm:   '#ffffff',
    green:     '#10b981',
    amber:     '#f59e0b',
    blue:      '#0ea5e9',
    red:       '#ef4444',
    totalBg:   '#e6faf6',
  }

      const M = { l: 40, r: 555, t: 40, w: 515 }

      // ══════════════════════════════════════════════════════
      //  SAYFA 1 – Başlık, Taraflar, Kalemler, Teslimat/Ödeme
      // ══════════════════════════════════════════════════════
      drawPage(doc, C, M, poNumber, contractDate, verifyUrl, 1)

      // ── Logo + Başlık ─────────────────────────────────────
      const logoExists = fs.existsSync(LOGO_PATH)
      if (logoExists) {
        doc.image(LOGO_PATH, M.l, M.t, { height: 44, fit: [120, 44] })
      } else {
        // Fallback: "K" kutusu
        doc.save()
          .roundedRect(M.l, M.t + 2, 44, 44, 8)
          .fillAndStroke(C.primary, C.primary)
        doc.fontSize(20).fillColor(C.dark).font('Helvetica-Bold')
          .text('K', M.l, M.t + 11, { width: 44, align: 'center' })
        doc.restore()
        doc.fontSize(18).fillColor(C.white).font('Helvetica-Bold')
          .text('KUNYE', M.l + 52, M.t + 6)
        doc.fontSize(9).fillColor(C.primary).font('Helvetica')
          .text('Dijital Tedarik Platformu', M.l + 52, M.t + 28)
      }

      // Sağda başlık
      doc.fontSize(18).fillColor(C.white).font('Helvetica-Bold')
        .text('SIPARIS EMRI', 0, M.t + 6, { width: M.r, align: 'right' })
      doc.fontSize(10).fillColor(C.primary).font('Helvetica')
        .text('PURCHASE ORDER', 0, M.t + 28, { width: M.r, align: 'right' })

      let y = M.t + 68

      // ── PO Bilgileri (üst bilgi kutusu) ───────────────────
      y = infoBox(doc, C, M, y, [
        ['Siparis No / PO Number', poNumber,    'Duzenleme Tarihi',  contractDate],
        ['Revizyon No',            'R0',          'Gecerlilik Tarihi', contractDate],
      ])

      y += 12

      // ── TARAFLAR ──────────────────────────────────────────
      y = sectionTitle(doc, C, M, y, 'TARAFLAR / PARTIES')

      const halfW = (M.w - 12) / 2
      const partyLX = M.l
      const partyRX = M.l + halfW + 12

      // Müşteri kutusu
      partyBox(doc, C, partyLX, y, halfW,
        'MUSTERI / CUSTOMER', '(Satinalma Taraf)',
        [
          ['Ticaret Unvani', T(customerCompany || customerName)],
          ['Adres',          T(customerAddress  || '—')],
          ['Vergi D. / No',  T(customerTaxOffice ? `${customerTaxOffice} / ${customerTaxNumber}` : '—')],
          ['Yetkili',        T(customerName)],
          ['E-posta',        customerEmail || '—'],
          ['Telefon',        T(customerPhone || '—')],
        ]
      )

      // Tedarikçi kutusu
      partyBox(doc, C, partyRX, y, halfW,
        'TEDARIKCI / SUPPLIER', '(Satis Taraf)',
        [
          ['Ticaret Unvani', T(supplierCompany || supplierName)],
          ['Adres',          T(supplierAddress  || '—')],
          ['Vergi D. / No',  T(supplierTaxOffice ? `${supplierTaxOffice} / ${supplierTaxNumber}` : '—')],
          ['Yetkili',        T(supplierName)],
          ['E-posta',        supplierEmail || '—'],
          ['Telefon',        T(supplierPhone || '—')],
        ]
      )

      y += 170

      // ── SİPARİŞ KALEMLERİ ────────────────────────────────
      y = sectionTitle(doc, C, M, y, 'SIPARIS KALEMLERI / ORDER ITEMS')

      const cols = [28, 160, 65, 42, 48, 86, 86]  // toplam = 515 = M.w
      const colHdrs = ['No', 'Parca / Aciklama', 'Tek.Dok.Rev.', 'Miktar', 'Birim', 'Birim Fiyat (TL)', 'Toplam (TL)']

      // Table header
      let tx = M.l
      doc.fillColor(C.primary).rect(M.l, y, M.w, 20).fill()
      colHdrs.forEach((h, i) => {
        doc.fontSize(7.5).fillColor(C.dark).font('Helvetica-Bold')
          .text(h, tx + 3, y + 6, { width: cols[i] - 6, align: i > 1 ? 'center' : 'left' })
        tx += cols[i]
      })
      y += 20

      let calcTotal = 0
      const items = quotationItems && quotationItems.length > 0 ? quotationItems : []

      items.forEach((item, idx) => {
        const rowBg = idx % 2 === 0 ? C.rowNorm : C.rowAlt
        const qty  = Number(item.quantity) || 1
        const up   = Number(item.price)    || 0
        const tot  = qty * up
        calcTotal += tot

        const revLabel = item.revision ? `Rev.${item.revision}` : '—'
        const cells = [
          String(idx + 1),
          T(item.title || item.file_name || '—'),
          revLabel,
          String(qty),
          'Adet',
          fmtNum(up),
          fmtNum(tot),
        ]

        // Parça adının kaç satır tutacağını hesapla
        const nameHeight = doc.heightOfString(cells[1], { width: cols[1] - 6, lineGap: 1 })
        const rowH = Math.max(20, nameHeight + 8)

        doc.fillColor(rowBg).rect(M.l, y, M.w, rowH).fill()
        doc.strokeColor(C.border).lineWidth(0.3).rect(M.l, y, M.w, rowH).stroke()

        tx = M.l
        cells.forEach((c, i) => {
          const cellY = i === 1 ? y + 4 : y + (rowH - 10) / 2
          doc.fontSize(8).fillColor(C.text).font(i === 1 ? 'Helvetica-Bold' : 'Helvetica')
            .text(c, tx + 3, cellY, { width: cols[i] - 6, align: i > 1 ? 'center' : 'left' })
          tx += cols[i]
        })
        y += rowH
      })

      if (items.length === 0) {
        doc.fillColor(C.rowAlt).rect(M.l, y, M.w, 18).fill()
        doc.fontSize(8).fillColor(C.muted).font('Helvetica')
          .text('Kalem bilgisi bulunamadi', M.l + 5, y + 5)
        y += 18
      }

      // Toplam satırları
      const finalTotal = calcTotal > 0 ? calcTotal : (Number(totalPrice) || 0)
      const kdv = finalTotal * 0.20
      const genelToplam = finalTotal + kdv

      y = summaryRows(doc, C, M, y, [
        ['Ara Toplam:', fmtCur(finalTotal)],
        ['KDV (%20):',  fmtCur(kdv)],
      ], ['GENEL TOPLAM:', fmtCur(genelToplam)])

      y += 14

      // ── TESLİMAT VE KALİTE ───────────────────────────────
      // Yeni sayfaya geç gerekiyorsa
      if (y > 650) { doc.addPage(); y = 60; drawPageBg(doc, C, M) }

      y = sectionTitle(doc, C, M, y, 'TESLIMAT VE KALITE / DELIVERY & QUALITY')

      const halfW2 = (M.w - 12) / 2
      const delLX = M.l
      const delRX = M.l + halfW2 + 12

      infoGroup(doc, C, delLX, y, halfW2, 'TESLIMAT KOSULLARI', [
        ['Termin Tarihi',   deliveryDate || '—'],
        ['Teslimat Yeri',   T(customerAddress || 'Giris Kontrolu')],
        ['Teslimat Sekli',  'DDP'],
        ['Kismi Teslimat',  'Musteri onayi ile kabul edilir'],
        ['Ambalaj',         'Standart'],
      ])

      infoGroup(doc, C, delRX, y, halfW2, 'KALITE GEREKSINIMLERI', [
        ['Kalite Std.',     'ISO 9001:2015'],
        ['Muayene',         'FAI + Seri uretim kontrolu'],
        ['Sertifikalar',    'Malzeme sert. (3.1), Boyut rap.'],
        ['Test Raporu',     'Musteri sartnamesine uygun'],
        ['Izlenebilirlik',  'Lot bazli tam izlenebilirlik zorunlu'],
      ])

      y += 105

      // ── ÖDEME KOŞULLARI ───────────────────────────────────
      y = sectionTitle(doc, C, M, y, 'ODEME KOSULLARI / PAYMENT TERMS')

      const payDue = paymentDueDate
        ? `Fatura tarihinden ${Math.round((new Date(paymentDueDate) - now) / 86400000)} gun`
        : 'Teslimattan sonra 30 gun'
      infoGroup(doc, C, M.l, y, M.w, null, [
        ['Odeme Vadesi',    payDue],
        ['Odeme Yontemi',   'Banka havalesi (EFT)'],
        ['Para Birimi',     'TRY'],
        ['Gecikme Faizi',   'TCMB reeskont faizi + 5 puan'],
      ], true)

      y += 60

      // ══════════════════════════════════════════════════════
      //  SAYFA 2 – Genel Koşullar
      // ══════════════════════════════════════════════════════
      doc.addPage()
      drawPage(doc, C, M, poNumber, contractDate, verifyUrl, 2)
      y = 60

      y = sectionTitle(doc, C, M, y, 'GENEL KOSULLAR VE HUKUMLER / GENERAL TERMS')

      const clauses = [
        ['1. KAPSAM',
          'Bu siparis emri, yukarida belirtilen urun ve/veya hizmetlerin tedarikini kapsar. Tedarikci, urunleri belirtilen teknik dokumanlara, cizimlere ve spesifikasyonlara uygun olarak uretmek/tedarik etmekle yukumludur. Siparis emrinde belirtilmeyen ancak teknik dokumanlarda yer alan gereksinimler de bu siparis kapsamindadir.'],
        ['2. TESLIMAT VE GECIKME',
          'Urunler belirtilen termin tarihinde, belirtilen teslimat yerine teslim edilecektir. Termin tarihinde gecikme ongordugunde tedarikci en az 15 is gunu onceden musteriyi yazili olarak bilgilendirir. Gecikme durumunda gunluk %0,2 (binde iki) gecikme cezasi uygulanir. Maksimum ceza tutari ilgili siparis kaleminin bedelinin %15ini gecemez. Musteri, 30 takvim gununu asan gecikmelerde siparisi feshetme hakkini sakli tutar.'],
        ['3. MUAYENE VE KABUL',
          'Musteri, teslim edilen urunleri giris kontrolunde muayene etme hakkina sahiptir. Uygunsuz bulunan urunler 10 is gunu icinde tedarikciye iade edilir. Tedarikci, iade edilen urunleri 15 is gunu icinde uygun urunle degistirir veya tamir eder. Giris kontrolunden gecis, garanti yukumluluklerini ortadan kaldirmaz.'],
        ['4. KALITE GARANTISI',
          'Tedarikci, urunlerin teslim tarihinden itibaren 24 ay sureyle malzeme ve iscilik hatalarina karsi garantili oldugunu taahhut eder. Garanti suresi icinde tespit edilen uygunsuzluklar tedarikci tarafindan ucretsiz olarak giderilir.'],
        ['5. DEGISIKLIK YONETIMI',
          'Siparis kapsaminda degisiklik ancak her iki tarafin yazili mutabakatı ile yapilabilir. Degisiklik talepleri Kunye platformu uzerinden resmi degisiklik emri (Change Order) ile iletilir. Onaylanmamis degisiklikler gecersizdir.'],
        ['6. GIZLILIK',
          'Taraflar, bu siparis kapsaminda paylasilan tum teknik bilgi, cizim, spesifikasyon ve ticari bilgileri gizli tutmayi ve ucuncu taraflarla paylasmamayi taahhut eder. Bu yukumluluk sozlesme sona erdikten sonra 5 yil sureyle devam eder.'],
        ['7. FIKRI MULKIYET',
          'Musteri tarafindan saglanan tum teknik dokumanlar, cizimler ve tasarimlar musterinin mulkiyetindedir. Tedarikci bu bilgileri sadece bu siparis kapsaminda kullanabilir.'],
        ['8. KVKK',
          '6698 sayili Kisisel Verilerin Korunmasi Kanunu kapsaminda taraflar yukumluluklerini yerine getirmeyi taahhut eder. Detaylar: https://kunye.tech/kvkk'],
        ['9. SIGORTA',
          'Tedarikci, urunlerin teslimat yerine kadar tasinmasi sirasinda olusabilecek hasarlara karsi sigorta yaptirmakla yukumludur.'],
        ['10. MUCBIR SEBEPLER',
          'Dogal afet, savas, grev, pandemi, hukumet kararlari gibi taraflarin kontrolu disindaki olaylar mucbir sebep sayilir. 90 takvim gununu asan mucbir sebep halinde, taraflardan her biri siparisi cezasiz feshedebilir.'],
        ['11. FESIH',
          'Taraflardan birinin yukumluluklerini yerine getirmemesi durumunda, diger taraf 15 is gunluk yazili ihtar suresinin ardindan sozlesmeyi feshedebilir.'],
        ['12. UYUSMAZLIK COZUMU',
          'Bu siparisten dogan uyusmazliklarda oncelikle arabuluculuk yoluna basvurulur. Arabuluculuk surecinin sonucsuz kalmasi halinde Istanbul Mahkemeleri ve Icra Daireleri yetkilidir.'],
      ]

      clauses.forEach(([title, text]) => {
        if (y > 730) { doc.addPage(); drawPage(doc, C, M, poNumber, contractDate, verifyUrl, 2); y = 60 }
        doc.fontSize(8.5).fillColor(C.primary).font('Helvetica-Bold')
          .text(title, M.l, y, { width: M.w })
        y += 13
        doc.fontSize(8).fillColor(C.white).font('Helvetica')
          .text(text, M.l, y, { width: M.w, lineGap: 2 })
        y += doc.heightOfString(text, { width: M.w, lineGap: 2 }) + 10
      })

      // ══════════════════════════════════════════════════════
      //  SAYFA 3 – Dijital Onay
      // ══════════════════════════════════════════════════════
      doc.addPage()
      drawPage(doc, C, M, poNumber, contractDate, verifyUrl, 3)
      y = 60

      // Onay başlığı
      doc.fillColor(C.green).rect(M.l, y, M.w, 36).fill()
      doc.fontSize(14).fillColor(C.white).font('Helvetica-Bold')
        .text('SIPARIS ONAYLANDI / ORDER CONFIRMED', M.l, y + 11, { width: M.w, align: 'center' })
      y += 44

      doc.fontSize(9).fillColor(C.white).font('Helvetica')
        .text(
          'Bu siparis emri her iki tarafca Kunye platformu uzerinden dijital olarak onaylanmistir. Ayrica islak imza gerekmemektedir.',
          M.l, y, { width: M.w, align: 'center' }
        )
      y += 24

      // İmza kutuları
      const sigW = (M.w - 16) / 2
      sigBox(doc, C, M.l,           y, sigW, 'MUSTERI ONAYI / CUSTOMER',
        T(customerCompany || customerName), T(customerName), contractDate, `APR-C-${year}-${seq}`)
      sigBox(doc, C, M.l + sigW + 16, y, sigW, 'TEDARIKCI ONAYI / SUPPLIER',
        T(supplierCompany || supplierName), T(supplierName), contractDate, `APR-S-${year}-${seq}`)

      y += 150

      // Hash / Doğrulama
      const hashStr = Buffer.from(`${poNumber}:${contractDate}:${T(projectName)}`).toString('base64').substring(0, 32).toUpperCase()
      doc.fontSize(7.5).fillColor(C.muted).font('Helvetica')
        .text(`Dokuman Butunluk Kodu: ${hashStr}`, M.l, y, { width: M.w, align: 'center' })
      y += 12
      doc.fillColor(C.primary)
        .text(`Dogrulama: ${verifyUrl}`, M.l, y, { width: M.w, align: 'center' })

      doc.end()
    } catch (err) {
      console.error('PDF generation error:', err)
      reject(err)
    }
  })
}

// ─── Yardımcı Fonksiyonlar ─────────────────────────────────────────────────

/** Türkçe karakterleri ASCII'ye çevir */
function T(text) {
  if (!text) return ''
  return String(text)
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/[^\x00-\x7F]/g, '')
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtCur(n) {
  return `${fmtNum(n)} TL`
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return String(dateStr)
    const yr = d.getFullYear()
    if (yr < 2020 || yr > 2100) return '—'
    return d.toLocaleDateString('tr-TR')
  } catch { return String(dateStr) }
}

/** Her sayfanın arkaplanını / üst+alt çizgilerini çizer */
function drawPageBg(doc, C, M) {
  doc.fillColor(C.dark).rect(0, 0, 595, 842).fill()
}

/** Her sayfa başında çizilecek dekoratif arka plan + header + footer */
function drawPage(doc, C, M, poNumber, contractDate, verifyUrl, pageNum) {
  // Arka plan
  doc.fillColor(C.dark).rect(0, 0, 595, 842).fill()
  // Üst accent çizgi
  doc.fillColor(C.primary).rect(0, 0, 595, 4).fill()
  // Alt footer şeridi
  doc.fillColor(C.headerBg).rect(0, 808, 595, 34).fill()
  doc.fontSize(7).fillColor(C.muted).font('Helvetica')
    .text(`Kunye Teknoloji A.S. | kunye.tech | info@kunye.tech`, M.l, 816, { width: 300 })
    .text(`Sayfa ${pageNum}  |  Dogrulama: ${verifyUrl}`, 0, 816, { width: M.r, align: 'right' })
}

/** PO bilgileri kutusu — [[sol label, sol val, sag label, sag val]] */
function infoBox(doc, C, M, y, rows) {
  const h = rows.length * 20 + 8
  doc.fillColor(C.headerBg).roundedRect(M.l, y, M.w, h, 6).fill()
  doc.strokeColor(C.primary).lineWidth(1).roundedRect(M.l, y, M.w, h, 6).stroke()

  const hw = M.w / 2
  rows.forEach(([lLabel, lVal, rLabel, rVal], i) => {
    const ry = y + 6 + i * 20
    doc.fontSize(7.5).fillColor(C.white).font('Helvetica')
      .text(lLabel + ':', M.l + 8, ry, { width: 110 })
    doc.fontSize(8.5).fillColor(C.primary).font('Helvetica-Bold')
      .text(lVal, M.l + 120, ry, { width: hw - 130 })

    if (rLabel) {
      doc.fontSize(7.5).fillColor(C.white).font('Helvetica')
        .text(rLabel + ':', M.l + hw + 8, ry, { width: 110 })
      doc.fontSize(8.5).fillColor(C.primary).font('Helvetica-Bold')
        .text(rVal, M.l + hw + 120, ry, { width: hw - 130 })
    }
  })
  return y + h
}

/** Bölüm başlığı */
function sectionTitle(doc, C, M, y, title) {
  doc.fillColor(C.primary).rect(M.l, y, M.w, 18).fill()
  doc.fontSize(8.5).fillColor(C.dark).font('Helvetica-Bold')
    .text(title, M.l + 6, y + 5, { width: M.w - 12 })
  return y + 22
}

/** Taraf bilgi kutusu */
function partyBox(doc, C, x, y, w, title, subtitle, fields) {
  const h = 160
  doc.fillColor(C.headerBg).roundedRect(x, y, w, h, 6).fill()
  doc.strokeColor(C.border).lineWidth(0.5).roundedRect(x, y, w, h, 6).stroke()

  doc.fillColor(C.primary).roundedRect(x, y, w, 22, 4).fill()
  doc.fontSize(8).fillColor(C.dark).font('Helvetica-Bold')
    .text(title, x + 6, y + 7, { width: w - 12 })
  doc.fontSize(7).fillColor(C.dark).font('Helvetica')
    .text(subtitle, x + 6, y + 7, { width: w - 12, align: 'right' })

  let fy = y + 28
  fields.forEach(([label, val]) => {
    doc.fontSize(7).fillColor(C.white).font('Helvetica')
      .text(label + ':', x + 6, fy, { width: 70 })
    doc.fontSize(8).fillColor(C.white).font('Helvetica-Bold')
      .text(val || '—', x + 78, fy, { width: w - 86 })
    fy += 16
  })
}

/** Bilgi grubu (teslimat / kalite gibi) */
function infoGroup(doc, C, x, y, w, title, fields, horizontal = false) {
  const h = title ? (fields.length * 16 + 28) : (fields.length * 16 + 10)
  doc.fillColor(C.headerBg).roundedRect(x, y, w, h, 6).fill()
  doc.strokeColor(C.border).lineWidth(0.5).roundedRect(x, y, w, h, 6).stroke()

  let fy = y + 6
  if (title) {
    doc.fontSize(7.5).fillColor(C.primary).font('Helvetica-Bold')
      .text(title, x + 6, fy, { width: w - 12 })
    fy += 18
  }

  fields.forEach(([label, val]) => {
    if (horizontal) {
      doc.fontSize(7.5).fillColor(C.white).font('Helvetica')
        .text(label + ':', x + 6, fy, { width: 100 })
      doc.fontSize(8).fillColor(C.white).font('Helvetica-Bold')
        .text(val || '—', x + 108, fy, { width: w - 116 })
    } else {
      doc.fontSize(7).fillColor(C.white).font('Helvetica')
        .text(label + ':', x + 6, fy, { width: 80 })
      doc.fontSize(7.5).fillColor(C.white).font('Helvetica-Bold')
        .text(val || '—', x + 88, fy, { width: w - 96 })
    }
    fy += 16
  })
}

/** Toplam satırları */
function summaryRows(doc, C, M, y, rows, totalRow) {
  rows.forEach(([label, val]) => {
    doc.fillColor(C.rowAlt).rect(M.l, y, M.w, 16).fill()
    doc.fontSize(8).fillColor(C.text).font('Helvetica')
      .text(label, M.l + 5, y + 4, { width: M.w - 100, align: 'right' })
    doc.fontSize(8).fillColor(C.text).font('Helvetica')
      .text(val, M.r - 90, y + 4, { width: 88, align: 'right' })
    y += 16
  })
  // Genel toplam
  doc.fillColor(C.primary).rect(M.l, y, M.w, 22).fill()
  doc.fontSize(10).fillColor(C.dark).font('Helvetica-Bold')
    .text(totalRow[0], M.l + 5, y + 6, { width: M.w - 100, align: 'right' })
  doc.fontSize(10).fillColor(C.dark).font('Helvetica-Bold')
    .text(totalRow[1], M.r - 90, y + 6, { width: 88, align: 'right' })
  return y + 22
}

/** İmza kutusu */
function sigBox(doc, C, x, y, w, title, company, name, date, approvalId) {
  const h = 140
  doc.fillColor(C.headerBg).roundedRect(x, y, w, h, 6).fill()
  doc.strokeColor(C.border).lineWidth(0.5).roundedRect(x, y, w, h, 6).stroke()

  // Başlık
  doc.fillColor(C.primary).roundedRect(x, y, w, 22, 4).fill()
  doc.fontSize(8).fillColor(C.dark).font('Helvetica-Bold')
    .text(title, x + 6, y + 7, { width: w - 12, align: 'center' })

  // Onay işareti
  doc.fontSize(28).fillColor(C.green)
    .text('✓', x, y + 30, { width: w, align: 'center' })

  doc.fontSize(9).fillColor(C.white).font('Helvetica-Bold')
    .text(company || name, x + 6, y + 66, { width: w - 12, align: 'center' })
  doc.fontSize(8).fillColor(C.white).font('Helvetica')
    .text(name, x + 6, y + 80, { width: w - 12, align: 'center' })

  // İmza çizgisi
  doc.strokeColor(C.border).lineWidth(0.8)
    .moveTo(x + 20, y + 98).lineTo(x + w - 20, y + 98).stroke()

  doc.fontSize(7.5).fillColor(C.white).font('Helvetica')
    .text(`Tarih: ${date}`, x + 6, y + 104, { width: w - 12, align: 'center' })
  doc.fontSize(7).fillColor(C.primary)
    .text(`Onay ID: ${approvalId}`, x + 6, y + 117, { width: w - 12, align: 'center' })
}
