import html_to_pdf from 'html-pdf-node'

/**
 * Sözleşme PDF'i oluşturur
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

  // HTML şablonu
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 40px;
          color: #1a1a1a;
          line-height: 1.6;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 3px solid #00d4aa;
          padding-bottom: 20px;
        }
        .header h1 {
          color: #00d4aa;
          font-size: 28px;
          margin-bottom: 10px;
        }
        .header p {
          color: #666;
          font-size: 12px;
        }
        .section {
          margin-bottom: 25px;
        }
        .section-title {
          color: #00d4aa;
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
        }
        .parties {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-bottom: 25px;
        }
        .party {
          background: #f9f9f9;
          padding: 15px;
          border-radius: 8px;
        }
        .party-title {
          color: #00d4aa;
          font-weight: bold;
          margin-bottom: 8px;
          font-size: 14px;
        }
        .party-info {
          font-size: 12px;
          margin: 5px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
          font-size: 11px;
        }
        thead {
          background: #00d4aa;
          color: white;
        }
        th, td {
          padding: 10px;
          text-align: left;
          border: 1px solid #ddd;
        }
        tbody tr:nth-child(even) {
          background: #f9f9f9;
        }
        .total-row {
          background: #f0f9f7 !important;
          font-weight: bold;
          font-size: 13px;
        }
        .total-row td {
          color: #00d4aa;
        }
        .terms {
          background: #fff9e6;
          padding: 15px;
          border-left: 4px solid #ff9800;
          margin: 20px 0;
        }
        .terms-title {
          color: #ff9800;
          font-weight: bold;
          margin-bottom: 10px;
          font-size: 14px;
        }
        .terms ul {
          margin-left: 20px;
          font-size: 11px;
        }
        .terms li {
          margin: 8px 0;
        }
        .signatures {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 50px;
          margin-top: 50px;
        }
        .signature {
          text-align: center;
        }
        .signature-title {
          color: #00d4aa;
          font-weight: bold;
          margin-bottom: 50px;
          font-size: 13px;
        }
        .signature-line {
          border-top: 2px solid #333;
          margin: 10px 0;
          padding-top: 10px;
        }
        .signature-company {
          color: #00d4aa;
          font-weight: bold;
          font-size: 12px;
        }
        .signature-name {
          color: #666;
          font-size: 11px;
        }
        .signature-date {
          color: #666;
          font-size: 10px;
          margin-top: 5px;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          color: #666;
          font-size: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>İMALAT SÖZLEŞMESİ</h1>
        <p>Proje ID: ${projectId} | Tarih: ${contractDate}</p>
      </div>

      <div class="section">
        <div class="section-title">📋 Proje Bilgileri</div>
        <p><strong>Proje Adı:</strong> ${projectName}</p>
        ${projectPartNumber ? `<p><strong>Parça Numarası:</strong> ${projectPartNumber}</p>` : ''}
        <p><strong>Termin Tarihi:</strong> ${deliveryDate}</p>
      </div>

      <div class="section">
        <div class="section-title">🏢 Taraflar</div>
        <div class="parties">
          <div class="party">
            <div class="party-title">MÜŞTERİ</div>
            <div class="party-info"><strong>Şirket:</strong> ${customerCompany || customerName}</div>
            <div class="party-info"><strong>İletişim:</strong> ${customerName}</div>
          </div>
          <div class="party">
            <div class="party-title">TEDARİKÇİ</div>
            <div class="party-info"><strong>Şirket:</strong> ${supplierCompany || supplierName}</div>
            <div class="party-info"><strong>İletişim:</strong> ${supplierName}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">💰 Fiyat Detayları</div>
        <table>
          <thead>
            <tr>
              <th>Parça/Kalem</th>
              <th style="text-align: center; width: 80px;">Adet</th>
              <th style="text-align: right; width: 120px;">Birim Fiyat</th>
              <th style="text-align: right; width: 120px;">Toplam</th>
            </tr>
          </thead>
          <tbody>
            ${quotationItems.map(item => `
              <tr>
                <td>${item.title || item.file_name}</td>
                <td style="text-align: center;">${item.quantity}</td>
                <td style="text-align: right;">₺${Number(item.price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                <td style="text-align: right;">₺${(Number(item.price) * Number(item.quantity)).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3" style="text-align: right;"><strong>TOPLAM TUTAR:</strong></td>
              <td style="text-align: right;"><strong>₺${Number(totalPrice).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="terms">
        <div class="terms-title">⚠️ Sözleşme Koşulları</div>
        <ul>
          <li>Bu sözleşme, yukarıda belirtilen taraflar arasında karşılıklı mutabakat ile imzalanmıştır.</li>
          <li>Belirtilen fiyatlar KDV hariçtir.</li>
          <li>Termin tarihi ${deliveryDate} olarak belirlenmiştir. Termin değişiklikleri yazılı olarak bildirilmelidir.</li>
          <li>Ürün teslim öncesi kalite kontrol yapılacaktır.</li>
          <li>Ödeme koşulları: Teslimattan sonra 30 gün içinde.</li>
          <li>Teknik çizim ve spesifikasyonlara uygunluk garanti edilir.</li>
        </ul>
      </div>

      <div class="signatures">
        <div class="signature">
          <div class="signature-title">MÜŞTERİ ONAYI</div>
          <div class="signature-line">
            <div class="signature-company">${customerCompany || customerName}</div>
            <div class="signature-name">${customerName}</div>
            <div class="signature-date">Tarih: ${contractDate}</div>
          </div>
        </div>
        <div class="signature">
          <div class="signature-title">TEDARİKÇİ ONAYI</div>
          <div class="signature-line">
            <div class="signature-company">${supplierCompany || supplierName}</div>
            <div class="signature-name">${supplierName}</div>
            <div class="signature-date">Tarih: ${contractDate}</div>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>Bu sözleşme elektronik ortamda oluşturulmuş olup, iki tarafın da onayı ile geçerlidir.</p>
        <p>Sözleşme ID: ${projectId} | Oluşturma Tarihi: ${contractDate}</p>
      </div>
    </body>
    </html>
  `

  const options = { 
    format: 'A4',
    margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
  }

  const file = { content: htmlContent }
  
  try {
    const pdfBuffer = await html_to_pdf.generatePdf(file, options)
    return pdfBuffer
  } catch (error) {
    console.error('PDF generation error:', error)
    throw error
  }
}
