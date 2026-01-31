import express from 'express'
import { supabaseAdmin } from '../db/supabase.js'
import { authenticateToken } from '../middleware/supabaseAuth.js'

const router = express.Router()

// Verify email confirmation token
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body

    if (!token) {
      return res.status(400).json({ error: 'Onay token\'ı gerekli.' })
    }

    // Verify the token with Supabase
    const { data, error } = await supabaseAdmin.auth.verifyOtp({
      token_hash: token,
      type: 'signup'
    })

    if (error) {
      console.error('Email verification error:', error)
      
      // Try alternative method - verify using the token directly
      try {
        const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
        
        if (userError || !userData) {
          return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş onay linki.' })
        }

        // User is verified, get profile info
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('username')
          .eq('id', userData.user.id)
          .single()

        return res.json({
          message: 'Email başarıyla onaylandı.',
          username: profile?.username,
          email: userData.user.email
        })
      } catch (altError) {
        return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş onay linki.' })
      }
    }

    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('id', data.user.id)
      .single()

    res.json({
      message: 'Email başarıyla onaylandı.',
      username: profile?.username,
      email: data.user.email
    })
  } catch (error) {
    console.error('Verify email error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Login with username/password
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli.' })
    }

    // Find user by username in profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, role, company_name')
      .eq('username', username)
      .single()

    if (profileError || !profile) {
      return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' })
    }

    // Get email from auth.users
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(profile.id)
    
    if (!authUser || !authUser.user) {
      return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' })
    }

    // Try to login with email and password
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email: authUser.user.email,
      password
    })

    if (error) {
      console.error('Login error:', error)
      return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' })
    }

    res.json({
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: profile.id,
        username: profile.username,
        role: profile.role,
        company_name: profile.company_name
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Public register endpoint (for landing page - creates customer)
router.post('/register-public', async (req, res) => {
  try {
    const { email, password, username, company_name } = req.body

    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Email, şifre ve kullanıcı adı gerekli.' })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Geçerli bir email adresi giriniz.' })
    }

    // Check if email already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
    const emailExists = existingUser?.users?.some(u => u.email === email)
    
    if (emailExists) {
      return res.status(400).json({ error: 'Bu email adresi zaten kullanılıyor.' })
    }

    // Check if username already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single()

    if (existingProfile) {
      return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' })
    }

    // Get redirect URL for email confirmation
    const redirectUrl = process.env.FRONTEND_URL || 
      (process.env.NODE_ENV === 'production' ? 'https://kunye.tech' : 'http://localhost:5173')
    const confirmUrl = `${redirectUrl}/auth/confirm`

    // Create user in Supabase Auth with customer role
    // For local development, skip email confirmation. Set NODE_ENV=production to require email confirmation
    const requireEmailConfirmation = process.env.NODE_ENV === 'production' && process.env.REQUIRE_EMAIL_CONFIRMATION !== 'false'
    
    let data, error
    
    if (requireEmailConfirmation) {
      // Use signUp (not admin.createUser) to trigger email confirmation
      const signUpResult = await supabaseAdmin.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            role: 'customer',
            company_name: company_name || ''
          },
          emailRedirectTo: confirmUrl
        }
      })
      data = signUpResult.data
      error = signUpResult.error
    } else {
      // Use admin.createUser for auto-confirmed users
      const createResult = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username,
          role: 'customer',
          company_name: company_name || ''
        }
      })
      data = createResult.data
      error = createResult.error
    }

    if (error) {
      console.error('Auth create user error:', error)
      
      if (error.message.includes('already been registered') || 
          error.message.includes('User already registered') ||
          error.message.includes('duplicate key')) {
        return res.status(400).json({ error: 'Bu email adresi zaten kullanılıyor.' })
      }
      
      if (error.message.includes('invalid email')) {
        return res.status(400).json({ error: 'Geçersiz email adresi.' })
      }
      
      if (error.message.includes('password')) {
        return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' })
      }
      
      return res.status(400).json({ error: 'Kullanıcı oluşturulurken bir hata oluştu.' })
    }

    // Create or update profile with customer role
    // Use upsert because trigger might have already created a profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: data.user.id,
        username,
        role: 'customer',
        company_name: company_name || ''
      }, { onConflict: 'id' })

    if (profileError) {
      console.error('Profile create error:', profileError)
      
      // Rollback: delete auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(data.user.id)
      
      if (profileError.code === '23505') {
        // Check if it's username conflict
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('username')
          .eq('username', username)
          .single()
        
        if (existingProfile && existingProfile.username === username) {
          return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' })
        }
        
        return res.status(400).json({ error: 'Bu kullanıcı zaten kayıtlı.' })
      }
      
      return res.status(500).json({ error: 'Profil oluşturulurken hata oluştu.' })
    }

    // Note: Supabase should automatically send confirmation email when email_confirm: false
    // If email doesn't arrive, check:
    // 1. Supabase Dashboard -> Authentication -> Logs (check for email sending errors)
    // 2. Spam folder
    // 3. SMTP settings (Supabase -> Authentication -> Email -> SMTP Settings)
    console.log('User created, confirmation email should be sent automatically by Supabase')
    console.log('If email not received, check Supabase logs and spam folder')

    // If email confirmation is required, show confirmation message
    // Otherwise, auto-login the user
    if (requireEmailConfirmation) {
      res.status(201).json({
        message: 'Kayıt başarıyla oluşturuldu. Email adresinize gönderilen onay linkine tıklayarak hesabınızı aktifleştirin.',
        requires_confirmation: true,
        email: email
      })
    } else {
      // Auto-confirm in development - return user info for auto-login
      res.status(201).json({
        message: 'Kayıt başarıyla tamamlandı.',
        requires_confirmation: false,
        username: username,
        email: email
      })
    }
  } catch (error) {
    console.error('Public register error:', error)
    res.status(500).json({ error: error.message || 'Sunucu hatası.' })
  }
})

// Register new supplier (simplified endpoint for quick supplier creation)
router.post('/register-supplier', authenticateToken, async (req, res) => {
  try {
    const { username, password, company_name, email } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli.' })
    }

    // Only customers and admins can create suppliers
    if (req.user.role !== 'customer' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için yetki gerekli.' })
    }

    // If no email provided, generate a placeholder email
    const finalEmail = email || `${username}@noemail.local`

    // Validate email format (if provided)
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Geçerli bir email adresi giriniz.' })
      }

      // Check if email already exists
      const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
      const emailExists = existingUser?.users?.some(u => u.email === email)
      
      if (emailExists) {
        return res.status(400).json({ error: 'Bu email adresi zaten kullanılıyor.' })
      }
    }

    // Check if username already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .single()

    if (existingProfile) {
      return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' })
    }

    // Create user in Supabase Auth with 'user' role (supplier)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: finalEmail,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        role: 'user',
        company_name: company_name || ''
      }
    })

    if (error) {
      console.error('Auth create user error:', error)
      
      if (error.message.includes('already been registered') || 
          error.message.includes('User already registered') ||
          error.message.includes('duplicate key')) {
        return res.status(400).json({ error: 'Bu email adresi zaten kullanılıyor.' })
      }
      
      if (error.message.includes('invalid email')) {
        return res.status(400).json({ error: 'Geçersiz email adresi.' })
      }
      
      if (error.message.includes('password')) {
        return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' })
      }
      
      return res.status(400).json({ error: 'Kullanıcı oluşturulurken bir hata oluştu.' })
    }

    // Create/update profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: data.user.id,
        username,
        role: 'user',
        company_name: company_name || '',
        created_by: req.user.id
      }, { onConflict: 'id' })

    if (profileError) {
      console.error('Profile create error:', profileError)
      
      // Rollback: delete auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(data.user.id)
      
      if (profileError.code === '23505') {
        return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' })
      }
      
      return res.status(500).json({ error: 'Profil oluşturulurken hata oluştu.' })
    }

    res.status(201).json({
      message: 'Tedarikçi başarıyla oluşturuldu.',
      id: data.user.id,
      username,
      company_name: company_name || ''
    })
  } catch (error) {
    console.error('Register supplier error:', error)
    res.status(500).json({ error: error.message || 'Sunucu hatası.' })
  }
})

// Register new user (admin/customer only - requires auth)
router.post('/register', authenticateToken, async (req, res) => {
  try {
    const { password, username, role = 'user', company_name } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli.' })
    }

    // Check permissions: admin can create anyone, customer can only create users
    if (req.user.role === 'customer' && role !== 'user') {
      return res.status(403).json({ error: 'Müşteriler sadece tedarikçi oluşturabilir.' })
    }

    // Only admins can create customers or other admins
    if ((role === 'customer' || role === 'admin') && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Bu rol için admin yetkisi gerekli.' })
    }

    // Generate email from username
    const email = `${username.toLowerCase().replace(/\s/g, '')}@kunye.local`

    // Create user in Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        role,
        company_name
      }
    })

    if (error) {
      console.error('Auth create user error:', error)
      console.error('Error details:', { message: error.message, code: error.code, status: error.status })
      
      // Türkçe hata mesajları
      if (error.message.includes('already been registered') || 
          error.message.includes('User already registered') ||
          error.message.includes('duplicate key') ||
          error.message.includes('Database error creating new user')) {
        return res.status(400).json({ error: 'Bu email adresi veya kullanıcı adı zaten kullanılıyor.' })
      }
      
      if (error.message.includes('invalid email')) {
        return res.status(400).json({ error: 'Geçersiz email adresi.' })
      }
      
      if (error.message.includes('password')) {
        return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' })
      }
      
      // Genel hata
      return res.status(400).json({ error: 'Kullanıcı oluşturulurken bir hata oluştu. Lütfen farklı bir email veya kullanıcı adı deneyin.' })
    }

    // Manually update profile if trigger didn't work
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: data.user.id,
        username,
        role,
        company_name,
        created_by: req.user.id
      }, { onConflict: 'id' })

    if (profileError) {
      console.error('Profile update error:', profileError)
      
      // Eğer unique constraint hatası varsa
      if (profileError.code === '23505') {
        // Auth user'ı silmeye çalış (rollback)
        await supabaseAdmin.auth.admin.deleteUser(data.user.id)
        return res.status(400).json({ error: 'Bu kullanıcı adı veya email zaten kullanılıyor.' })
      }
      
      return res.status(500).json({ error: 'Profil oluşturulurken hata oluştu.' })
    }

    res.status(201).json({
      message: 'Kullanıcı başarıyla oluşturuldu.',
      user: {
        id: data.user.id,
        username
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

// Get all suppliers (for admin/customer dropdown)
router.get('/suppliers', authenticateToken, async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('profiles')
      .select('id, username, company_name, created_by')
      .eq('role', 'user')

    // Customers can only see suppliers they created
    if (req.user.role === 'customer') {
      query = query.eq('created_by', req.user.id)
    }
    // Admins see all suppliers

    const { data, error } = await query

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
    console.log('📋 GET /users - User Role:', req.user.role, 'User ID:', req.user.id)
    
    if (req.user.role !== 'admin' && req.user.role !== 'customer') {
      return res.status(403).json({ error: 'Bu işlem için yetki gerekli.' })
    }

    let query = supabaseAdmin
      .from('profiles')
      .select('id, username, role, company_name, created_by, created_at')
      .order('created_at', { ascending: false })

    // Customers can only see users they created
    if (req.user.role === 'customer') {
      console.log('🔍 Customer filter: created_by =', req.user.id)
      query = query.eq('created_by', req.user.id)
    }
    // Admins see all users

    const { data, error } = await query
    
    console.log('📊 Query result count:', data?.length)
    console.log('📊 Sample data:', data?.slice(0, 2))

    if (error) throw error

    res.json(data)
  } catch (error) {
    console.error('Get users error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Update user (admin can update anyone, customer can update users they created)
router.patch('/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'customer') {
      return res.status(403).json({ error: 'Bu işlem için yetki gerekli.' })
    }

    const { username, role, company_name, password } = req.body
    const userId = req.params.id

    // If customer, verify they created this user and they can't change role
    if (req.user.role === 'customer') {
      const { data: profile, error: fetchError } = await supabaseAdmin
        .from('profiles')
        .select('created_by, role')
        .eq('id', userId)
        .single()

      if (fetchError) {
        console.error('Fetch profile error:', fetchError)
        return res.status(404).json({ error: 'Kullanıcı bulunamadı.' })
      }

      if (profile.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Sadece oluşturduğunuz kullanıcıları düzenleyebilirsiniz.' })
      }

      // Customer can't change role
      if (role && role !== profile.role) {
        return res.status(403).json({ error: 'Rol değiştirme yetkiniz yok.' })
      }
    }

    // Update password if provided
    if (password && password.trim() !== '') {
      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: password }
      )

      if (passwordError) {
        console.error('Password update error:', passwordError)
        return res.status(400).json({ error: 'Şifre güncellenirken hata oluştu.' })
      }
    }

    // Update profile
    const updateData = { username, company_name }
    // Only admin can change role
    if (req.user.role === 'admin' && role) {
      updateData.role = role
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', userId)

    if (profileError) {
      console.error('Profile update error:', profileError)
      throw profileError
    }

    res.json({ message: 'Kullanıcı başarıyla güncellendi.' })
  } catch (error) {
    console.error('Update user error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Delete user (admin can delete anyone, customer can delete users they created)
router.delete('/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'customer') {
      return res.status(403).json({ error: 'Bu işlem için yetki gerekli.' })
    }

    const userId = req.params.id

    // If customer, verify they created this user
    if (req.user.role === 'customer') {
      const { data: profile, error: fetchError } = await supabaseAdmin
        .from('profiles')
        .select('created_by')
        .eq('id', userId)
        .single()

      if (fetchError) {
        console.error('Fetch profile error:', fetchError)
        return res.status(404).json({ error: 'Kullanıcı bulunamadı.' })
      }

      if (profile.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Sadece oluşturduğunuz kullanıcıları silebilirsiniz.' })
      }
    }

    // Delete from auth (cascades to profiles)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (error) {
      console.error('Delete user error:', error)
      throw error
    }

    res.json({ message: 'Kullanıcı başarıyla silindi.' })
  } catch (error) {
    console.error('Delete user error:', error)
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
