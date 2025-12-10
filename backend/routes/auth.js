import express from 'express'
import { supabaseAdmin } from '../db/supabase.js'
import { authenticateToken } from '../middleware/supabaseAuth.js'

const router = express.Router()

// Login with email/password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email ve şifre gerekli.' })
    }

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      return res.status(401).json({ error: error.message })
    }

    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    res.json({
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        username: profile?.username || data.user.email,
        role: profile?.role || 'user',
        company_name: profile?.company_name
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, username, role = 'user', company_name } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email ve şifre gerekli.' })
    }

    // Create user in Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username: username || email.split('@')[0],
        role,
        company_name
      }
    })

    if (error) {
      console.error('Auth create user error:', error)
      if (error.message.includes('already been registered')) {
        return res.status(400).json({ error: 'Bu email adresi zaten kayıtlı.' })
      }
      return res.status(400).json({ error: error.message })
    }

    // Manually update profile if trigger didn't work
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: data.user.id,
        username: username || email.split('@')[0],
        role,
        company_name
      }, { onConflict: 'id' })

    if (profileError) {
      console.error('Profile update error:', profileError)
    }

    res.status(201).json({
      message: 'Kullanıcı başarıyla oluşturuldu.',
      user: {
        id: data.user.id,
        email: data.user.email
      }
    })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ error: error.message || 'Sunucu hatası.' })
  }
})

// Get current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
      role: req.user.role,
      company_name: req.user.company_name
    })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Get all suppliers (for admin dropdown)
router.get('/suppliers', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, company_name')
      .eq('role', 'user')

    if (error) throw error

    res.json(data)
  } catch (error) {
    console.error('Get suppliers error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Get all users (admin only)
router.get('/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli.' })
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, role, company_name, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Get emails from auth.users
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
    
    const usersWithEmail = data.map(profile => {
      const authUser = authUsers?.users?.find(u => u.id === profile.id)
      return {
        ...profile,
        email: authUser?.email || 'N/A'
      }
    })

    res.json(usersWithEmail)
  } catch (error) {
    console.error('Get users error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body

    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token gerekli.' })
    }

    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token
    })

    if (error) {
      return res.status(401).json({ error: 'Geçersiz refresh token.' })
    }

    res.json({
      token: data.session.access_token,
      refresh_token: data.session.refresh_token
    })
  } catch (error) {
    console.error('Refresh error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

export default router
