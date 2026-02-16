import { supabaseAdmin } from '../db/supabase.js'

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Erişim reddedildi. Token gerekli.' })
  }

  try {
    // Verify the JWT token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !user) {
      return res.status(403).json({ error: 'Geçersiz token.' })
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return res.status(403).json({ error: 'Kullanıcı profili bulunamadı.' })
    }

    req.user = {
      id: user.id,
      email: user.email,
      username: profile.username,
      role: profile.role,
      user_type: profile.user_type,
      company_name: profile.company_name,
      invite_code: profile.invite_code,
      is_customer_admin: profile.is_customer_admin,
      customer_id: profile.customer_id
    }
    req.accessToken = token
    next()
  } catch (error) {
    console.error('Auth error:', error)
    return res.status(403).json({ error: 'Token doğrulama hatası.' })
  }
}

export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli.' })
  }
  next()
}

export const requireAdminOrCustomer = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Bu işlem için admin veya müşteri yetkisi gerekli.' })
  }
  next()
}

export const requireUser = (req, res, next) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ error: 'Bu işlem için tedarikçi yetkisi gerekli.' })
  }
  next()
}






