import PDFDocument from 'pdfkit'

/**
 * Sözleşme PDF'i oluşturur (PDFKit ile - Puppeteer gerektirmez)
 * @param {Object} contractData - Sözleşme bilgileri
 * @returns {Promise<Buffer>} - PDF buffer
 */
export async function generateContractPDF(contractData) {
  const {
    projectName,
    projectPartNumber,
    customerName,
    customerCompany,
    supplierName,
    supplierCompany,
    quotationItems,
    totalPrice,
    deliveryDate,
    contractDate,
    projectId
  } = contractData

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 50,
        info: {
          Title: `Imalat Sozlesmesi - ${projectName}`,
          Author: 'M-Chain System'
        }
      })
      
      const buffers = []
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers)
        resolve(pdfBuffer)
      })
      doc.on('error', reject)

      // Colors
      const primaryColor = '#00d4aa'
      const textColor = '#1a1a1a'
      const grayColor = '#666666'
      const warningColor = '#ff9800'

      // ============ HEADER ============
      doc.fontSize(24)
         .fillColor(primaryColor)
         .text('IMALAT SOZLESMESI', { align: 'center' })
      
      doc.moveDown(0.3)
      doc.fontSize(10)
         .fillColor(grayColor)
         .text(`Proje ID: ${projectId} | Tarih: ${contractDate}`, { align: 'center' })
      
      // Header line
      doc.moveDown(0.5)
      doc.strokeColor(primaryColor)
         .lineWidth(2)
         .moveTo(50, doc.y)
         .lineTo(545, doc.y)
         .stroke()
      
      doc.moveDown(1)

      // ============ PROJE BİLGİLERİ ============
      doc.fontSize(14)
         .fillColor(primaryColor)
         .text('Proje Bilgileri', { continued: false })
      
      doc.moveDown(0.5)
      doc.fontSize(11)
         .fillColor(textColor)
         .text(`Proje Adi: ${sanitizeText(projectName)}`)
      
      if (projectPartNumber) {
        doc.text(`Parca Numarasi: ${sanitizeText(projectPartNumber)}`)
      }
      
      doc.text(`Termin Tarihi: ${formatDate(deliveryDate)}`)
      
      doc.moveDown(1)

      // ============ TARAFLAR ============
      doc.fontSize(14)
         .fillColor(primaryColor)
         .text('Taraflar')
      
      doc.moveDown(0.5)
      
      const partiesY = doc.y
      const leftColX = 50
      const rightColX = 300
      
      // Müşteri (Sol)
      doc.fontSize(12)
         .fillColor(primaryColor)
         .text('MUSTERI', leftColX, partiesY)
      
      doc.fontSize(10)
         .fillColor(textColor)
         .text(`Sirket: ${sanitizeText(customerCompany || customerName)}`, leftColX, partiesY + 18)
         .text(`Iletisim: ${sanitizeText(customerName)}`, leftColX, partiesY + 32)
      
      // Tedarikçi (Sağ)
      doc.fontSize(12)
         .fillColor(primaryColor)
         .text('TEDARIKCI', rightColX, partiesY)
      
      doc.fontSize(10)
         .fillColor(textColor)
         .text(`Sirket: ${sanitizeText(supplierCompany || supplierName)}`, rightColX, partiesY + 18)
         .text(`Iletisim: ${sanitizeText(supplierName)}`, rightColX, partiesY + 32)
      
      doc.y = partiesY + 60
      doc.moveDown(1)

      // ============ FİYAT DETAYLARI ============
      doc.fontSize(14)
         .fillColor(primaryColor)
         .text('Fiyat Detaylari')
      
      doc.moveDown(0.5)

      // Table headers
      const tableTop = doc.y
      const tableLeft = 50
      const colWidths = [200, 60, 100, 100]
      const headers = ['Parca/Kalem', 'Adet', 'Birim Fiyat', 'Toplam']
      
      // Header background
      doc.fillColor(primaryColor)
         .rect(tableLeft, tableTop, 495, 22)
         .fill()
      
      // Header text
      doc.fillColor('#ffffff')
         .fontSize(10)
      
      let xPos = tableLeft + 5
      headers.forEach((header, i) => {
        const width = colWidths[i] - 10
        if (i === 0) {
          doc.text(header, xPos, tableTop + 6, { width, align: 'left' })
        } else {
          doc.text(header, xPos, tableTop + 6, { width, align: 'right' })
        }
        xPos += colWidths[i]
      })

      // Table rows
      let rowY = tableTop + 25
      doc.fillColor(textColor)
         .fontSize(9)

      // Hesaplanan toplam (item'lardan)
      let calculatedTotal = 0

      if (quotationItems && quotationItems.length > 0) {
        quotationItems.forEach((item, index) => {
          const rowBg = index % 2 === 0 ? '#ffffff' : '#f9f9f9'
          doc.fillColor(rowBg)
             .rect(tableLeft, rowY, 495, 20)
             .fill()
          
          doc.fillColor(textColor)
          
          xPos = tableLeft + 5
          
          // Parça adı
          const itemTitle = sanitizeText(item.title || item.file_name || '-')
          doc.text(itemTitle, xPos, rowY + 5, { width: colWidths[0] - 10 })
          xPos += colWidths[0]
          
          // Adet
          const quantity = Number(item.quantity) || 1
          doc.text(String(quantity), xPos, rowY + 5, { width: colWidths[1] - 10, align: 'right' })
          xPos += colWidths[1]
          
          // Birim Fiyat
          const unitPrice = Number(item.price) || 0
          doc.text(formatCurrency(unitPrice), xPos, rowY + 5, { width: colWidths[2] - 10, align: 'right' })
          xPos += colWidths[2]
          
          // Toplam (birim fiyat × adet)
          const itemTotal = unitPrice * quantity
          calculatedTotal += itemTotal
          doc.text(formatCurrency(itemTotal), xPos, rowY + 5, { width: colWidths[3] - 10, align: 'right' })
          
          rowY += 20
        })
      } else {
        // Hiç item yoksa boş satır göster
        doc.fillColor('#f9f9f9')
           .rect(tableLeft, rowY, 495, 20)
           .fill()
        doc.fillColor(grayColor)
           .text('Fiyat bilgisi bulunamadi', tableLeft + 5, rowY + 5)
        rowY += 20
      }

      // Total row - hesaplanan toplamı kullan
      const finalTotal = calculatedTotal > 0 ? calculatedTotal : (Number(totalPrice) || 0)
      
      doc.fillColor('#f0f9f7')
         .rect(tableLeft, rowY, 495, 25)
         .fill()
      
      doc.fontSize(11)
         .fillColor(primaryColor)
         .text('TOPLAM TUTAR:', tableLeft + 300, rowY + 7, { width: 100, align: 'right' })
         .text(formatCurrency(finalTotal), tableLeft + 400, rowY + 7, { width: 90, align: 'right' })
      
      doc.y = rowY + 35
      doc.moveDown(1)

      // ============ SÖZLEŞME KOŞULLARI ============
      // Warning box
      const termsY = doc.y
      doc.fillColor('#fff9e6')
         .rect(50, termsY, 495, 130)
         .fill()
      
      doc.strokeColor(warningColor)
         .lineWidth(3)
         .moveTo(50, termsY)
         .lineTo(50, termsY + 130)
         .stroke()
      
      doc.fontSize(12)
         .fillColor(warningColor)
         .text('Sozlesme Kosullari', 60, termsY + 10)
      
      doc.fontSize(9)
         .fillColor(textColor)
      
      const formattedDeliveryDate = formatDate(deliveryDate)
      const terms = [
        'Bu sozlesme, yukarida belirtilen taraflar arasinda karsilikli mutabakat ile imzalanmistir.',
        'Belirtilen fiyatlar KDV harictir.',
        `Termin tarihi ${formattedDeliveryDate} olarak belirlenmistir. Degisiklikler yazili bildirilmelidir.`,
        'Urun teslim oncesi kalite kontrol yapilacaktir.',
        'Odeme kosullari: Teslimattan sonra 30 gun icinde.',
        'Teknik cizim ve spesifikasyonlara uygunluk garanti edilir.'
      ]
      
      let termY = termsY + 30
      terms.forEach(term => {
        doc.text(`- ${term}`, 65, termY, { width: 470 })
        termY += 16
      })
      
      doc.y = termsY + 145

      // ============ İMZALAR ============
      // Check if we need a new page
      if (doc.y > 650) {
        doc.addPage()
      }
      
      doc.moveDown(2)
      
      const sigY = doc.y
      
      // Müşteri İmza
      doc.fontSize(11)
         .fillColor(primaryColor)
         .text('MUSTERI ONAYI', 80, sigY, { align: 'left' })
      
      doc.moveTo(60, sigY + 60)
         .lineTo(230, sigY + 60)
         .strokeColor(textColor)
         .lineWidth(1)
         .stroke()
      
      doc.fontSize(10)
         .fillColor(primaryColor)
         .text(sanitizeText(customerCompany || customerName), 60, sigY + 65, { width: 170, align: 'center' })
      
      doc.fillColor(grayColor)
         .fontSize(9)
         .text(sanitizeText(customerName), 60, sigY + 78, { width: 170, align: 'center' })
         .text(`Tarih: ${contractDate}`, 60, sigY + 91, { width: 170, align: 'center' })
      
      // Tedarikçi İmza
      doc.fontSize(11)
         .fillColor(primaryColor)
         .text('TEDARIKCI ONAYI', 360, sigY, { align: 'left' })
      
      doc.moveTo(330, sigY + 60)
         .lineTo(500, sigY + 60)
         .strokeColor(textColor)
         .lineWidth(1)
         .stroke()
      
      doc.fontSize(10)
         .fillColor(primaryColor)
         .text(sanitizeText(supplierCompany || supplierName), 330, sigY + 65, { width: 170, align: 'center' })
      
      doc.fillColor(grayColor)
         .fontSize(9)
         .text(sanitizeText(supplierName), 330, sigY + 78, { width: 170, align: 'center' })
         .text(`Tarih: ${contractDate}`, 330, sigY + 91, { width: 170, align: 'center' })

      // ============ FOOTER ============
      doc.y = 750
      doc.strokeColor('#dddddd')
         .lineWidth(0.5)
         .moveTo(50, doc.y)
         .lineTo(545, doc.y)
         .stroke()
      
      doc.moveDown(0.5)
      doc.fontSize(8)
         .fillColor(grayColor)
         .text('Bu sozlesme elektronik ortamda olusturulmus olup, iki tarafin da onayi ile gecerlidir.', { align: 'center' })
         .text(`Sozlesme ID: ${projectId} | Olusturma Tarihi: ${contractDate}`, { align: 'center' })

      // Finalize
      doc.end()
    } catch (error) {
      console.error('PDF generation error:', error)
      reject(error)
    }
  })
}

/**
 * Türkçe karakterleri ASCII'ye dönüştür (PDFKit uyumluluğu için)
 */
function sanitizeText(text) {
  if (!text) return ''
  return String(text)
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/📄/g, '').replace(/🏢/g, '').replace(/💰/g, '').replace(/⚠️/g, '')
}

/**
 * Tarihi formatla
 */
function formatDate(dateStr) {
  if (!dateStr) return '-'
  try {
    // Geçersiz yıl kontrolü (42424 gibi)
    if (dateStr.includes('42424') || dateStr.includes('9999')) {
      return 'Belirtilmemis'
    }
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return String(dateStr)
    const year = date.getFullYear()
    // Mantıklı yıl aralığı kontrolü
    if (year < 2020 || year > 2100) {
      return 'Belirtilmemis'
    }
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  } catch {
    return String(dateStr)
  }
}

/**
 * Para birimini formatla
 */
function formatCurrency(amount) {
  const num = Number(amount) || 0
  // Türkçe format: 1.665,00
  return `TL${num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
