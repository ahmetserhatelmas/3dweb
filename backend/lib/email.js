import nodemailer from 'nodemailer'

function getTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  })
}

/**
 * Send "quotation accepted" + contract PDF to supplier
 * @param {string} toEmail - Supplier email
 * @param {string} supplierName - Supplier display name
 * @param {string} projectName - Project name
 * @param {Buffer} pdfBuffer - Contract PDF buffer
 * @param {string} [contractUrl] - Optional public URL to contract (fallback if attachment fails)
 */
export async function sendContractEmailToSupplier(toEmail, supplierName, projectName, pdfBuffer, contractUrl = '') {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn('⚠️ SMTP not configured, contract email skipped.')
    return { sent: false, error: 'SMTP not configured' }
  }

  const from = `"Kunye.tech" <${process.env.SMTP_USER}>`
  const subject = `Teklif kabul edildi – ${projectName} | Sözleşme`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #0a0e27, #1a1f3a); padding: 24px; border-radius: 12px; color: #fff;">
        <h2 style="color: #00d4aa; margin-top: 0;">Teklifiniz kabul edildi</h2>
        <p>Merhaba ${supplierName},</p>
        <p><strong>${projectName}</strong> projesi için verdiğiniz teklif müşteri tarafından kabul edildi. Proje size atandı.</p>
        <p>Ekte sözleşme PDF dosyası bulunmaktadır. Ayrıca projeyi Kunye.tech panelinden görüntüleyebilirsiniz.</p>
        ${contractUrl ? `<p><a href="${contractUrl}" style="color: #00d4aa;">Sözleşmeyi indir</a></p>` : ''}
        <p style="font-size: 12px; color: rgba(255,255,255,0.6); margin-top: 24px;">Bu e-posta Kunye.tech tarafından otomatik gönderilmiştir.</p>
      </div>
    </div>
  `

  const mailOptions = {
    from,
    to: toEmail,
    subject,
    html,
    attachments: pdfBuffer && pdfBuffer.length
      ? [{ filename: `Sozlesme_${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`, content: pdfBuffer }]
      : []
  }

  try {
    await transporter.sendMail(mailOptions)
    console.log('✅ Contract email sent to supplier:', toEmail)
    return { sent: true }
  } catch (err) {
    console.error('❌ Contract email error:', err.message)
    return { sent: false, error: err.message }
  }
}
