import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import cron from 'node-cron'
import nodemailer from 'nodemailer'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'
import authRoutes from './routes/auth.js'
import projectRoutes from './routes/projects.js'
import uploadRoutes from './routes/upload.js'
import revisionRoutes from './routes/revisions.js'
import { supabaseAdmin } from './db/supabase.js'

// Load environment variables
dotenv.config()

// Initialize Sentry (Error Tracking)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [
      nodeProfilingIntegration(),
    ],
  })
  console.log('✅ Sentry initialized')
} else {
  console.warn('⚠️  Sentry DSN not found, error tracking disabled')
}

// Production environment check
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS'
  ]
  
  const missing = requiredEnvVars.filter(v => !process.env[v])
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '))
    process.exit(1)
  }
  console.log('✅ All required environment variables present')
}

// Email transporter configuration
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Security Headers (Helmet.js)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", process.env.SUPABASE_URL || "*"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"],
      frameSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for WASM/STEP viewer
  crossOriginResourcePolicy: { policy: "cross-origin" },
}))

// CORS Configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? (process.env.FRONTEND_URL 
        ? [process.env.FRONTEND_URL, 'https://kunye.tech', 'https://www.kunye.tech']
        : true) // Allow all origins in production if FRONTEND_URL not set (for Railway temp URLs)
    : ['http://localhost:5173', 'http://localhost:3001', 'http://127.0.0.1:5173'],
  credentials: true,
  optionsSuccessStatus: 200
}
app.use(cors(corsOptions))

// Request size limits
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Rate Limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: 'Çok fazla istek gönderdiniz, lütfen 15 dakika sonra tekrar deneyin.',
  standardHeaders: true,
  legacyHeaders: false,
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 100, // 5 in prod, 100 in dev
  skipSuccessfulRequests: true,
  message: 'Çok fazla giriş denemesi, 15 dakika sonra tekrar deneyin.',
})

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: 'Çok fazla dosya yüklendi, 1 saat sonra tekrar deneyin.',
})

// Apply rate limiters
app.use('/api', generalLimiter)
// TEMPORARILY DISABLED FOR TESTING
// app.use('/api/auth/login', authLimiter)
// app.use('/api/auth/register-public', authLimiter)
app.use('/api/upload', uploadLimiter)

// Static files for local uploads (fallback)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/revisions', revisionRoutes)

// Health check (improved)
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    database: 'unknown'
  }
  
  // Database connectivity check
  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .limit(1)
    health.database = error ? 'error' : 'ok'
  } catch (e) {
    health.database = 'error'
    health.database_error = e.message
  }
  
  const statusCode = health.database === 'ok' ? 200 : 503
  res.status(statusCode).json(health)
})

// Public config for frontend (şifre sıfırlama sayfası vb. - VITE_* build'ta olmasa da çalışsın)
app.get('/api/config', (req, res) => {
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY
  if (!url || !anonKey) return res.json({ supabaseUrl: null, supabaseAnonKey: null })
  res.json({ supabaseUrl: url, supabaseAnonKey: anonKey })
})

// Contact form endpoint
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Tüm alanlar zorunludur.' })
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Geçerli bir email adresi giriniz.' })
    }

    // Personal email domains that are not allowed
    const personalEmailDomains = [
      'gmail.com', 'googlemail.com',
      'hotmail.com', 'hotmail.co.uk', 'hotmail.fr', 'hotmail.de',
      'outlook.com', 'outlook.co.uk',
      'yahoo.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de', 'yahoo.com.tr',
      'ymail.com',
      'live.com', 'live.co.uk',
      'msn.com',
      'icloud.com', 'me.com', 'mac.com',
      'aol.com',
      'mail.com',
      'protonmail.com', 'proton.me',
      'zoho.com',
      'yandex.com', 'yandex.ru',
      'mail.ru',
      'gmx.com', 'gmx.de',
      'web.de',
      'tutanota.com',
      'fastmail.com'
    ]

    const domain = email.split('@')[1]?.toLowerCase()
    if (personalEmailDomains.includes(domain)) {
      return res.status(400).json({ error: 'Lütfen şirket e-posta adresinizi giriniz. Kişisel e-posta adresleri kabul edilmemektedir.' })
    }

    // Send email to info@kunye.tech
    const mailOptions = {
      from: `"Kunye.tech İletişim" <${process.env.SMTP_USER || 'noreply@kunye.tech'}>`,
      to: 'info@kunye.tech',
      replyTo: email,
      subject: `[Kunye.tech] Yeni İletişim Mesajı - ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0a0e27, #1a1f3a); padding: 30px; border-radius: 12px; color: #ffffff;">
            <h2 style="color: #00d4aa; margin-top: 0;">Yeni İletişim Mesajı</h2>
            
            <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong style="color: #00d4aa;">İsim:</strong></p>
              <p style="margin: 0 0 20px 0; color: #e0e0e0;">${name}</p>
              
              <p style="margin: 0 0 10px 0;"><strong style="color: #00d4aa;">Email:</strong></p>
              <p style="margin: 0 0 20px 0;"><a href="mailto:${email}" style="color: #00d4aa;">${email}</a></p>
              
              <p style="margin: 0 0 10px 0;"><strong style="color: #00d4aa;">Mesaj:</strong></p>
              <p style="margin: 0; color: #e0e0e0; white-space: pre-wrap;">${message}</p>
            </div>
            
            <p style="font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 30px; margin-bottom: 0;">
              Bu mesaj Kunye.tech web sitesi üzerinden gönderilmiştir.
            </p>
          </div>
        </div>
      `
    }

    // Check if SMTP is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('⚠️ SMTP not configured. Contact form submission:', { name, email, message })
      // Still return success but log the message
      return res.json({ success: true, message: 'Mesajınız alındı.' })
    }

    await emailTransporter.sendMail(mailOptions)
    console.log('✅ Contact email sent from:', email)

    res.json({ success: true, message: 'Mesajınız başarıyla gönderildi.' })
  } catch (error) {
    console.error('Contact form error:', error)
    res.status(500).json({ error: 'Mesaj gönderilemedi. Lütfen tekrar deneyin.' })
  }
})

// Sentry Test Endpoint (Development only)
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/test-sentry', (req, res) => {
    throw new Error('🧪 Test error for Sentry - This should appear in your dashboard!')
  })
  
  app.get('/api/test-sentry-async', async (req, res) => {
    try {
      throw new Error('🧪 Async test error for Sentry')
    } catch (error) {
      Sentry.captureException(error)
      throw error
    }
  })
}

// Global error handler (Sentry will automatically capture errors)
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err)
  
  // Capture to Sentry
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err)
  }
  
  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
    : err.message
    
  res.status(err.status || 500).json({ 
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  })
})

// Supabase Keepalive - Her 3 günde bir çalışır (database'i aktif tutar)
cron.schedule('0 3 */3 * *', async () => {
  try {
    console.log('🔄 Supabase keepalive başlatıldı...')
    
    // Basit bir query ile database'i uyandır
    const { count, error } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
    
    if (error) throw error
    
    console.log('✅ Supabase aktif tutuldu! Profile sayısı:', count)
    console.log('📅 Son çalışma:', new Date().toISOString())
  } catch (error) {
    console.error('❌ Supabase keepalive hatası:', error.message)
  }
})

const server = app.listen(PORT, () => {
  console.log(`🚀 M-Chain Backend running on http://localhost:${PORT}`)
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
  if (!process.env.SUPABASE_URL) {
    console.log('⚠️  Warning: SUPABASE_URL not set. Please configure .env file.')
  }
  if (process.env.SENTRY_DSN) {
    console.log('✅ Sentry error tracking enabled')
  }
  console.log('⏰ Supabase keepalive aktif - Her 3 günde bir çalışacak')
  console.log('🔒 Security: Helmet + Rate Limiting enabled')
})

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received, shutting down gracefully...`)
  server.close(() => {
    console.log('✅ Server closed')
    process.exit(0)
  })
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout')
    process.exit(1)
  }, 10000)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err)
  Sentry.captureException(err)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason)
  Sentry.captureException(reason)
})

