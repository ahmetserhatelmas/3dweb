import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import cron from 'node-cron'
import authRoutes from './routes/auth.js'
import projectRoutes from './routes/projects.js'
import uploadRoutes from './routes/upload.js'
import revisionRoutes from './routes/revisions.js'
import { supabaseAdmin } from './db/supabase.js'

// Load environment variables
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Static files for local uploads (fallback)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/revisions', revisionRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    supabase: process.env.SUPABASE_URL ? 'configured' : 'not configured'
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

app.listen(PORT, () => {
  console.log(`🚀 M-Chain Backend running on http://localhost:${PORT}`)
  if (!process.env.SUPABASE_URL) {
    console.log('⚠️  Warning: SUPABASE_URL not set. Please configure .env file.')
  }
  console.log('⏰ Supabase keepalive aktif - Her 3 günde bir çalışacak')
})
