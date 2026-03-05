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

const SITE_URL = process.env.FRONTEND_URL || 'https://kunye.tech'

function buildEmailWrapper(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0e27;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0e27;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,#0d1230,#1a2050);border-radius:12px 12px 0 0;padding:28px 32px;border-bottom:2px solid #00d4aa;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="display:inline-flex;align-items:center;gap:10px;">
                    <div style="width:40px;height:40px;background:linear-gradient(135deg,#00d4aa,#0ea5e9);border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;color:#000;text-align:center;line-height:40px;">K</div>
                    <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">Kunye.tech</span>
                  </div>
                </td>
                <td align="right" style="font-size:11px;color:rgba(255,255,255,0.4);">
                  KÜNYE Dijital Tedarik Platformu
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="background:#111828;padding:32px;color:#e2e8f0;font-size:15px;line-height:1.7;">
            ${bodyHtml}
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#0d1230;border-radius:0 0 12px 12px;padding:20px 32px;border-top:1px solid rgba(255,255,255,0.08);">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:12px;color:rgba(255,255,255,0.35);line-height:1.6;">
                  Bu e-posta <strong style="color:rgba(255,255,255,0.5);">Kunye.tech</strong> tarafından otomatik gönderilmiştir.<br>
                  <a href="${SITE_URL}" style="color:#00d4aa;text-decoration:none;">${SITE_URL}</a> &nbsp;|&nbsp;
                  <a href="mailto:info@kunye.tech" style="color:#00d4aa;text-decoration:none;">info@kunye.tech</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
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
  const subject = `Teklif Kabul Edildi – ${projectName} | Sipariş Emri`
  const html = buildEmailWrapper(`
    <h2 style="color:#00d4aa;margin-top:0;">🎉 Teklifiniz Kabul Edildi</h2>
    <p>Merhaba <strong>${supplierName}</strong>,</p>
    <p><strong>${projectName}</strong> projesi için verdiğiniz teklif müşteri tarafından kabul edildi. Proje size atandı.</p>
    <p>Ekte Sipariş Emri (Purchase Order) sözleşmesi bulunmaktadır.</p>
    ${contractUrl ? `<p><a href="${contractUrl}" style="background:#00d4aa;color:#000;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;margin-top:8px;">Sözleşmeyi İndir</a></p>` : ''}
    <p style="margin-top:24px;">Projenizi Kunye.tech panelinden yönetebilirsiniz:</p>
    <p><a href="${SITE_URL}/dashboard" style="color:#00d4aa;text-decoration:none;font-weight:600;">${SITE_URL}/dashboard →</a></p>
  `)

  const mailOptions = {
    from,
    to: toEmail,
    subject,
    html,
    attachments: pdfBuffer?.length
      ? [{ filename: `PO_${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`, content: pdfBuffer }]
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

/**
 * Send "quotation accepted" + contract PDF to customer (copy)
 */
export async function sendContractEmailToCustomer(toEmail, customerName, projectName, supplierName, pdfBuffer, contractUrl = '') {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn('⚠️ SMTP not configured, customer contract email skipped.')
    return { sent: false, error: 'SMTP not configured' }
  }

  const from = `"Kunye.tech" <${process.env.SMTP_USER}>`
  const subject = `Sipariş Onaylandı – ${projectName} | Sözleşme Kopyası`
  const html = buildEmailWrapper(`
    <h2 style="color:#00d4aa;margin-top:0;">Siparişiniz Onaylandı</h2>
    <p>Merhaba <strong>${customerName}</strong>,</p>
    <p><strong>${projectName}</strong> projesi için <strong>${supplierName}</strong> firmasının teklifini onayladınız.</p>
    <p>Ekte oluşturulan Sipariş Emri (Purchase Order) sözleşmesinin bir kopyası bulunmaktadır.</p>
    ${contractUrl ? `<p><a href="${contractUrl}" style="color:#00d4aa;font-weight:600;">Sözleşmeyi görüntüle / indir</a></p>` : ''}
    <p>Projenizi Kunye.tech panelinden takip edebilirsiniz.</p>
  `)

  const mailOptions = {
    from,
    to: toEmail,
    subject,
    html,
    attachments: pdfBuffer?.length
      ? [{ filename: `PO_${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`, content: pdfBuffer }]
      : []
  }

  try {
    await transporter.sendMail(mailOptions)
    console.log('✅ Contract email sent to customer:', toEmail)
    return { sent: true }
  } catch (err) {
    console.error('❌ Customer contract email error:', err.message)
    return { sent: false, error: err.message }
  }
}


/**
 * @param {string} [customerName] - Teklifi atayan musteri adi/firma
 */
export async function sendQuoteRequestToSupplier(toEmail, supplierName, projectName, quoteDueDate, customerName) {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn('⚠️ SMTP not configured, quote request email skipped.')
    return { sent: false, error: 'SMTP not configured' }
  }
  const dueStr = quoteDueDate ? new Date(quoteDueDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '3 gün içinde'
  const customerLine = customerName ? `<p><strong style="color:#fff;">${customerName}</strong> tarafından size teklif talebi atandı.</p>` : ''
  const from = `"Kunye.tech" <${process.env.SMTP_USER}>`
  const subject = `Yeni Teklif Talebi – ${projectName}`
  const html = buildEmailWrapper(`
    <h2 style="color:#00d4aa;margin-top:0;">📋 Yeni Teklif Talebi</h2>
    <p>Merhaba <strong>${supplierName}</strong>,</p>
    <p><strong>${projectName}</strong> projesi için size teklif talebi atandı.</p>
    ${customerLine}
    <div style="background:rgba(0,212,170,0.08);border-left:3px solid #00d4aa;padding:12px 16px;border-radius:4px;margin:16px 0;">
      <strong>Son Teklif Tarihi:</strong> ${dueStr}
    </div>
    <p>Teklifinizi Kunye.tech paneline giriş yaparak gönderebilirsiniz:</p>
    <p><a href="${SITE_URL}/dashboard" style="background:#00d4aa;color:#000;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;margin-top:8px;">Panele Git →</a></p>
  `)
  try {
    await transporter.sendMail({ from, to: toEmail, subject, html })
    console.log('✅ Quote request email sent to supplier:', toEmail)
    return { sent: true }
  } catch (err) {
    console.error('❌ Quote request email error:', err.message)
    return { sent: false, error: err.message }
  }
}

/**
 * Teklif süresinin son 1 günü kala tedarikçiye hatırlatma
 */
export async function sendQuoteReminder1DayLeft(toEmail, supplierName, projectName, quoteDueDate) {
  const transporter = getTransporter()
  if (!transporter) return { sent: false, error: 'SMTP not configured' }
  const dueStr = quoteDueDate ? new Date(quoteDueDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'yarın'
  const from = `"Kunye.tech" <${process.env.SMTP_USER}>`
  const subject = `⏰ Son Hatırlatma: ${projectName} – Teklif Süresi Yarın Doluyor`
  const html = buildEmailWrapper(`
    <h2 style="color:#f59e0b;margin-top:0;">⏰ Teklif Süresi Hatırlatması</h2>
    <p>Merhaba <strong>${supplierName}</strong>,</p>
    <p><strong>${projectName}</strong> projesi için teklif verme süreniz <strong style="color:#f59e0b;">${dueStr}</strong> tarihinde dolacaktır.</p>
    <div style="background:rgba(245,158,11,0.1);border-left:3px solid #f59e0b;padding:12px 16px;border-radius:4px;margin:16px 0;">
      Henüz teklif göndermediyseniz lütfen en kısa sürede teklifinizi gönderin.
    </div>
    <p><a href="${SITE_URL}/dashboard" style="background:#f59e0b;color:#000;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;margin-top:8px;">Teklif Ver →</a></p>
  `)
  try {
    await transporter.sendMail({ from, to: toEmail, subject, html })
    console.log('✅ Quote reminder (1 day left) sent to supplier:', toEmail)
    return { sent: true }
  } catch (err) {
    console.error('❌ Quote reminder email error:', err.message)
    return { sent: false, error: err.message }
  }
}
