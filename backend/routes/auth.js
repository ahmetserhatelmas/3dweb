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

// Login with username/password (with user_type: supplier, customer, or admin)
router.post('/login', async (req, res) => {
  try {
    const { username, password, user_type } = req.body
    
    console.log('🔐 Login attempt:', { username, user_type })

    if (!username || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli.' })
    }

    if (!user_type || !['supplier', 'customer', 'admin'].includes(user_type)) {
      console.log('❌ Invalid user_type:', user_type)
      return res.status(400).json({ error: 'Geçerli bir kullanıcı tipi seçiniz.' })
    }

    let profile, profileError

    if (user_type === 'admin') {
      // Admin login - check by username and role only (no user_type check)
      console.log('🔍 Admin login - searching for:', username)
      const result = await supabaseAdmin
        .from('profiles')
        .select('id, username, role, company_name, user_type, invite_code, is_customer_admin, customer_id')
        .eq('username', username)
        .eq('role', 'admin')
        .single()
      
      profile = result.data
      profileError = result.error
      console.log('Admin profile found:', !!profile)
    } else {
      // Supplier/Customer login - check by username and user_type
      console.log('🔍 User login - searching for:', username, user_type)
      const result = await supabaseAdmin
        .from('profiles')
        .select('id, username, role, company_name, user_type, invite_code, is_customer_admin, customer_id')
        .eq('username', username)
        .eq('user_type', user_type)
        .single()
      
      profile = result.data
      profileError = result.error
      console.log('User profile found:', !!profile)
    }

    if (profileError || !profile) {
      const errorMessages = {
        supplier: 'Tedarikçi hesabı bulunamadı. Lütfen bilgilerinizi kontrol edin.',
        customer: 'Müşteri hesabı bulunamadı. Lütfen bilgilerinizi kontrol edin.',
        admin: 'Admin hesabı bulunamadı. Lütfen bilgilerinizi kontrol edin.'
      }
      return res.status(401).json({ error: errorMessages[user_type] })
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

    console.log('✅ Login successful:', { username, role: profile.role })

    res.json({
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: profile.id,
        username: profile.username,
        role: profile.role,
        user_type: profile.user_type,
        company_name: profile.company_name,
        invite_code: profile.invite_code,
        is_customer_admin: profile.is_customer_admin,
        customer_id: profile.customer_id
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Public register endpoint (for landing page - creates customer or supplier)
router.post('/register-public', async (req, res) => {
  try {
    const { email, password, username, company_name, user_type } = req.body

    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Email, şifre ve kullanıcı adı gerekli.' })
    }

    if (!user_type || !['supplier', 'customer'].includes(user_type)) {
      return res.status(400).json({ error: 'Geçerli bir kullanıcı tipi seçiniz.' })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Geçerli bir email adresi giriniz.' })
    }

    // Check if username already exists for this user_type
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .eq('user_type', user_type)
      .single()

    if (existingProfile) {
      return res.status(400).json({ 
        error: `Bu kullanıcı adı ${user_type === 'supplier' ? 'tedarikçi' : 'müşteri'} hesabı için zaten kullanılıyor.` 
      })
    }

    // Get redirect URL for email confirmation
    const redirectUrl = process.env.FRONTEND_URL || 
      (process.env.NODE_ENV === 'production' ? 'https://kunye.tech' : 'http://localhost:5173')
    const confirmUrl = `${redirectUrl}/auth/confirm`

    // Create user in Supabase Auth
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
            role: user_type === 'supplier' ? 'user' : 'customer',
            user_type,
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
          role: user_type === 'supplier' ? 'user' : 'customer',
          user_type,
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

    // Create or update profile
    // Use upsert because trigger might have already created a profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: data.user.id,
        username,
        role: user_type === 'supplier' ? 'user' : 'customer',
        user_type,
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
          .select('username, user_type')
          .eq('username', username)
          .eq('user_type', user_type)
          .single()
        
        if (existingProfile && existingProfile.username === username) {
          return res.status(400).json({ 
            error: `Bu kullanıcı adı ${user_type === 'supplier' ? 'tedarikçi' : 'müşteri'} hesabı için zaten kullanılıyor.` 
          })
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
      user_type: req.user.user_type,
      company_name: req.user.company_name,
      invite_code: req.user.invite_code,
      is_customer_admin: req.user.is_customer_admin,
      customer_id: req.user.customer_id
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

    // Customers can only see suppliers they created OR suppliers their admin has access to
    if (req.user.role === 'customer') {
      // If user is a customer user (has customer_id), get suppliers from their admin
      let customerId = req.user.id
      if (req.user.customer_id) {
        customerId = req.user.customer_id
      }
      
      // Get suppliers connected to this customer via customer_suppliers
      const { data: connections } = await supabaseAdmin
        .from('customer_suppliers')
        .select('supplier_id')
        .eq('customer_id', customerId)
        .eq('status', 'active')
      
      const supplierIds = connections?.map(c => c.supplier_id) || []
      
      if (supplierIds.length === 0) {
        return res.json([])
      }
      
      query = query.in('id', supplierIds)
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

    let data

    // Customers see suppliers they are connected with via customer_suppliers table
    if (req.user.role === 'customer') {
      console.log('🔍 Customer filter: getting suppliers from customer_suppliers')
      
      // Determine which customer ID to use
      let customerId = req.user.id
      if (req.user.customer_id) {
        // If user is a customer user, use their admin's ID
        customerId = req.user.customer_id
      }
      
      // Get supplier IDs from customer_suppliers where customer is the current user or their admin
      const { data: connections, error: connError } = await supabaseAdmin
        .from('customer_suppliers')
        .select('supplier_id')
        .eq('customer_id', customerId)
        .eq('status', 'active')

      if (connError) throw connError

      const supplierIds = connections?.map(c => c.supplier_id) || []
      
      if (supplierIds.length === 0) {
        console.log('📊 No suppliers found for customer')
        return res.json([])
      }

      // Get profiles for these suppliers
      const { data: profiles, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, username, role, company_name, created_by, created_at')
        .in('id', supplierIds)
        .order('created_at', { ascending: false })

      if (profileError) throw profileError
      data = profiles
    } else {
      // Admins see all users with plan info
      const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('id, username, role, company_name, created_by, created_at, plan_type, plan_start_date, is_customer_admin')
        .order('created_at', { ascending: false })

      if (error) throw error
      data = profiles
    }
    
    console.log('📊 Query result count:', data?.length)
    console.log('📊 Sample data:', data?.slice(0, 2))

    res.json(data)
  } catch (error) {
    console.error('Get users error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Update customer plan (admin only)
router.patch('/customers/:id/plan', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Bu işlem için admin yetkisi gerekli.' })
    }

    const { plan_type } = req.body
    const customerId = req.params.id

    if (!plan_type || !['starter', 'business'].includes(plan_type)) {
      return res.status(400).json({ error: 'Geçerli bir plan tipi seçiniz (starter veya business).' })
    }

    // Verify this is a customer account
    const { data: customer, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('role, plan_type')
      .eq('id', customerId)
      .single()

    if (fetchError || !customer) {
      return res.status(404).json({ error: 'Müşteri bulunamadı.' })
    }

    if (customer.role !== 'customer') {
      return res.status(400).json({ error: 'Bu işlem sadece müşteri hesapları için geçerlidir.' })
    }

    // Update plan - only set plan_start_date if plan is changing
    const updateData = { plan_type }
    if (customer.plan_type !== plan_type) {
      updateData.plan_start_date = new Date().toISOString()
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', customerId)

    if (updateError) {
      console.error('Update plan error:', updateError)
      throw updateError
    }

    res.json({ 
      message: 'Plan başarıyla güncellendi.',
      plan_type,
      plan_start_date: updateData.plan_start_date
    })
  } catch (error) {
    console.error('Update customer plan error:', error)
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

// Validate invite code (no authentication required)
router.post('/validate-invite', async (req, res) => {
  try {
    const { invite_code } = req.body

    if (!invite_code) {
      return res.status(400).json({ error: 'Davet kodu gerekli.' })
    }

    // Find customer by invite code
    const { data: customer, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, company_name, user_type')
      .eq('invite_code', invite_code)
      .eq('user_type', 'customer')
      .single()

    if (error || !customer) {
      console.log('Invalid invite code:', invite_code)
      return res.status(404).json({ error: 'Davet kodu geçersiz.' })
    }

    res.json({
      valid: true,
      customer: {
        username: customer.username,
        company_name: customer.company_name
      }
    })
  } catch (error) {
    console.error('Validate invite error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Accept supplier invite (supplier connects to customer via invite code)
router.post('/accept-invite', authenticateToken, async (req, res) => {
  try {
    const { invite_code } = req.body

    if (!invite_code) {
      return res.status(400).json({ error: 'Davet kodu gerekli.' })
    }

    // Check if user is a supplier
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('user_type')
      .eq('id', req.user.id)
      .single()

    if (!profile || profile.user_type !== 'supplier') {
      return res.status(403).json({ error: 'Sadece tedarikçiler davet kodunu kullanabilir.' })
    }

    // Call Supabase function to accept invite
    console.log('Accepting invite:', { invite_code, supplier_id: req.user.id })
    const { data, error } = await supabaseAdmin.rpc('accept_supplier_invite', {
      p_invite_code: invite_code
    })

    if (error) {
      console.error('Accept invite RPC error:', error)
      return res.status(400).json({ error: 'Davet kodu kabul edilemedi: ' + error.message })
    }

    console.log('RPC result:', data)

    if (!data || !data.success) {
      return res.status(400).json({ error: data?.error || 'Davet kodu geçersiz.' })
    }

    res.json({
      message: 'Müşteri ile bağlantı kuruldu.',
      customer: data.customer
    })
  } catch (error) {
    console.error('Accept invite error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Get my customers (for suppliers)
router.get('/my-customers', authenticateToken, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('user_type')
      .eq('id', req.user.id)
      .single()

    if (!profile || profile.user_type !== 'supplier') {
      return res.status(403).json({ error: 'Sadece tedarikçiler müşterilerini görebilir.' })
    }

    const { data, error } = await supabaseAdmin
      .from('customer_suppliers')
      .select('*')
      .eq('supplier_id', req.user.id)
      .eq('status', 'active')

    if (error) {
      console.error('Get customers error:', error)
      throw error
    }

    res.json(data || [])
  } catch (error) {
    console.error('Get customers error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Get my suppliers (for customers)
router.get('/my-suppliers', authenticateToken, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('user_type')
      .eq('id', req.user.id)
      .single()

    if (!profile || profile.user_type !== 'customer') {
      return res.status(403).json({ error: 'Sadece müşteriler tedarikçilerini görebilir.' })
    }

    const { data, error } = await supabaseAdmin
      .from('customer_suppliers')
      .select('*')
      .eq('customer_id', req.user.id)
      .eq('status', 'active')

    if (error) {
      console.error('Get suppliers error:', error)
      throw error
    }

    res.json(data || [])
  } catch (error) {
    console.error('Get suppliers error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Remove supplier from customer's list (customer only - breaks the connection)
router.delete('/suppliers/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ error: 'Bu işlem sadece müşteriler için geçerlidir.' })
    }

    const supplierId = req.params.id
    
    // Determine which customer ID to use
    let customerId = req.user.id
    if (req.user.customer_id) {
      // If user is a customer user, they cannot remove suppliers (only admin can)
      return res.status(403).json({ error: 'Sadece müşteri adminleri tedarikçi çıkarabilir.' })
    }

    // Update customer_suppliers table to set status as 'inactive'
    const { error: updateError } = await supabaseAdmin
      .from('customer_suppliers')
      .update({ status: 'inactive' })
      .eq('customer_id', customerId)
      .eq('supplier_id', supplierId)

    if (updateError) {
      console.error('Remove supplier error:', updateError)
      throw updateError
    }

    res.json({ message: 'Tedarikçi listenizden çıkarıldı.' })
  } catch (error) {
    console.error('Remove supplier error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// ============= CUSTOMER USERS ENDPOINTS =============

// Get customer's supplier invite code
router.get('/my-invite-code', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ error: 'Sadece müşteriler tedarikçi davet edebilir' })
    }

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('invite_code')
      .eq('id', req.user.id)
      .single()

    if (error) throw error

    res.json({ invite_code: profile.invite_code })
  } catch (error) {
    console.error('Get invite code error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Get customer's user invite code (customer admin only)
router.get('/my-user-invite-code', authenticateToken, async (req, res) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('user_invite_code, is_customer_admin')
      .eq('id', req.user.id)
      .single()

    if (error) throw error

    if (!profile.is_customer_admin) {
      return res.status(403).json({ error: 'Sadece müşteri adminleri davet kodu görebilir.' })
    }

    res.json({ invite_code: profile.user_invite_code })
  } catch (error) {
    console.error('Get user invite code error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Validate user invite code (no authentication required)
router.post('/validate-user-invite', async (req, res) => {
  try {
    const { invite_code } = req.body

    if (!invite_code) {
      return res.status(400).json({ error: 'Davet kodu gerekli.' })
    }

    // Find customer by user invite code
    const { data: customer, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, company_name, user_type')
      .eq('user_invite_code', invite_code)
      .eq('role', 'customer')
      .eq('is_customer_admin', true)
      .single()

    if (error || !customer) {
      console.log('Invalid user invite code:', invite_code)
      return res.status(404).json({ error: 'Davet kodu geçersiz.' })
    }

    res.json({
      valid: true,
      customer: {
        username: customer.username,
        company_name: customer.company_name
      }
    })
  } catch (error) {
    console.error('Validate user invite error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Accept user invite (customer user joins customer account)
router.post('/accept-user-invite', authenticateToken, async (req, res) => {
  try {
    const { invite_code } = req.body

    if (!invite_code) {
      return res.status(400).json({ error: 'Davet kodu gerekli.' })
    }

    // Check if user is a customer
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('user_type, role, customer_id, is_customer_admin')
      .eq('id', req.user.id)
      .single()

    if (!profile || profile.user_type !== 'customer' || profile.role !== 'customer') {
      return res.status(403).json({ error: 'Sadece müşteriler davet kodunu kullanabilir.' })
    }

    // Check if user is already a customer admin (they can't join another customer)
    if (profile.is_customer_admin) {
      return res.status(400).json({ error: 'Müşteri adminleri başka bir hesaba katılamaz.' })
    }

    // Check if user is already connected to a customer
    if (profile.customer_id) {
      // Get the customer they're connected to
      const { data: existingCustomer } = await supabaseAdmin
        .from('profiles')
        .select('username, company_name, user_invite_code')
        .eq('id', profile.customer_id)
        .single()
      
      // If trying to join the same customer, return success
      if (existingCustomer && existingCustomer.user_invite_code === invite_code) {
        return res.json({
          message: 'Zaten bu müşteri hesabına bağlısınız.',
          customer: {
            id: profile.customer_id,
            username: existingCustomer.username,
            company_name: existingCustomer.company_name
          }
        })
      }
      
      return res.status(400).json({ 
        error: `Zaten "${existingCustomer?.company_name || existingCustomer?.username}" hesabına bağlısınız. Önce o hesaptan ayrılmalısınız.` 
      })
    }

    // Call Supabase function to accept invite
    console.log('Accepting user invite:', { invite_code, user_id: req.user.id })
    const { data, error } = await supabaseAdmin.rpc('accept_user_invite', {
      p_invite_code: invite_code
    })

    if (error) {
      console.error('Accept user invite RPC error:', error)
      return res.status(400).json({ error: 'Davet kodu kabul edilemedi: ' + error.message })
    }

    console.log('RPC result:', data)

    if (!data || !data.success) {
      return res.status(400).json({ error: data?.error || 'Davet kodu geçersiz.' })
    }

    res.json({
      message: 'Müşteri hesabına başarıyla katıldınız.',
      customer: data.customer
    })
  } catch (error) {
    console.error('Accept user invite error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Get customer's users (all customers can view, only admin can modify)
router.get('/my-customer-users', authenticateToken, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, customer_id, is_customer_admin')
      .eq('id', req.user.id)
      .single()

    if (!profile || profile.role !== 'customer') {
      return res.status(403).json({ error: 'Bu işlem sadece müşteriler için geçerlidir.' })
    }

    // Determine which customer's users to show
    let customerId = req.user.id
    if (profile.customer_id) {
      // If user is a customer user, show their admin's users
      customerId = profile.customer_id
    }

    // Get the admin's own info first
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, username, company_name, created_at')
      .eq('id', customerId)
      .single()

    const { data: adminAuth } = await supabaseAdmin.auth.admin.getUserById(customerId)

    const adminUser = {
      ...adminProfile,
      email: adminAuth?.user?.email,
      joined_at: adminProfile.created_at, // Admin's join date is when they created the account
      is_admin: true // Mark as admin
    }

    // Get users connected to this customer (davet ile eklenmiş kullanıcılar)
    const { data: connections, error: connError } = await supabaseAdmin
      .from('customer_users')
      .select('user_id, joined_at, status')
      .eq('customer_id', customerId)
      .eq('status', 'active')

    if (connError) throw connError

    let invitedUsers = []
    if (connections && connections.length > 0) {
      // Get user profiles (these are customer users who joined via invite)
      const userIds = connections.map(c => c.user_id)
      const { data: users, error: usersError } = await supabaseAdmin
        .from('profiles')
        .select('id, username, company_name, created_at')
        .in('id', userIds)

      if (usersError) throw usersError

      // Get auth emails and combine with join date
      invitedUsers = await Promise.all(
        users.map(async (user) => {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user.id)
          const connection = connections.find(c => c.user_id === user.id)
          return {
            ...user,
            email: authUser?.user?.email,
            joined_at: connection?.joined_at, // When they joined this customer account
            is_admin: false
          }
        })
      )
    }

    // Combine admin and invited users (admin first)
    const allUsers = [adminUser, ...invitedUsers]

    res.json(allUsers)
  } catch (error) {
    console.error('Get customer users error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Remove user from customer account (customer admin only)
router.delete('/customer-users/:id', authenticateToken, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_customer_admin, role')
      .eq('id', req.user.id)
      .single()

    if (!profile || profile.role !== 'customer' || !profile.is_customer_admin) {
      return res.status(403).json({ error: 'Sadece müşteri adminleri kullanıcı çıkarabilir.' })
    }

    const userId = req.params.id

    // Update customer_users to set status as inactive
    const { error: updateError } = await supabaseAdmin
      .from('customer_users')
      .update({ status: 'inactive' })
      .eq('customer_id', req.user.id)
      .eq('user_id', userId)

    if (updateError) throw updateError

    // Update user's customer_id to null
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ customer_id: null })
      .eq('id', userId)

    if (profileError) throw profileError

    res.json({ message: 'Kullanıcı hesaptan çıkarıldı.' })
  } catch (error) {
    console.error('Remove customer user error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Get customer usage statistics (for dashboard)
router.get('/my-usage-stats', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'customer') {
      // Customer usage stats
      let customerId = req.user.id
      if (req.user.customer_id) {
        customerId = req.user.customer_id
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('plan_type, plan_start_date')
        .eq('id', customerId)
        .single()

      if (profileError) throw profileError

      const planType = profile.plan_type || 'starter'

      const planLimits = {
        starter: {
          users: 3,
          suppliers: 10,
          rfq_per_month: 10,
          storage_gb: 1
        },
        business: {
          users: 10,
          suppliers: 40,
          rfq_per_month: 100,
          storage_gb: 10
        }
      }

      const limits = planLimits[planType]

      const { count: userCount } = await supabaseAdmin
        .from('customer_users')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', customerId)
        .eq('status', 'active')

      const { count: supplierCount } = await supabaseAdmin
        .from('customer_suppliers')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', customerId)
        .eq('status', 'active')

      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      let creatorIds = [customerId]
      const { data: customerUsers } = await supabaseAdmin
        .from('customer_users')
        .select('user_id')
        .eq('customer_id', customerId)
        .eq('status', 'active')
      
      if (customerUsers && customerUsers.length > 0) {
        creatorIds.push(...customerUsers.map(u => u.user_id))
      }

      const { count: rfqCount } = await supabaseAdmin
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .in('created_by', creatorIds)
        .gte('created_at', startOfMonth.toISOString())

      // Calculate storage used
      const { data: files, error: filesError } = await supabaseAdmin
        .from('project_files')
        .select('file_size, project:projects!inner(created_by)')
        .in('project.created_by', creatorIds)
        .eq('is_active', true)

      if (filesError) {
        console.error('Storage calculation error:', filesError)
      }

      const totalStorageBytes = files?.reduce((sum, f) => sum + (f.file_size || 0), 0) || 0
      const storageUsedGB = totalStorageBytes / (1024 * 1024 * 1024)

      res.json({
        plan_type: planType,
        plan_start_date: profile.plan_start_date,
        limits,
        usage: {
          users: userCount || 0,
          suppliers: supplierCount || 0,
          rfq_this_month: rfqCount || 0,
          storage_gb: parseFloat(storageUsedGB.toFixed(2))
        }
      })
    } else if (req.user.role === 'supplier' || req.user.role === 'user') {
      // Supplier usage stats - grouped by customer
      const { data: connections, error: connectionsError } = await supabaseAdmin
        .from('customer_suppliers')
        .select('customer_id, customer:profiles!customer_suppliers_customer_id_fkey(username, plan_type)')
        .eq('supplier_id', req.user.id)
        .eq('status', 'active')

      if (connectionsError) throw connectionsError

      const stats = []

      for (const conn of connections) {
        const customerId = conn.customer_id
        const planType = conn.customer?.plan_type || 'starter'

        const planLimits = {
          starter: {
            users: 3,
            suppliers: 10,
            rfq_per_month: 10,
            storage_gb: 1
          },
          business: {
            users: 10,
            suppliers: 40,
            rfq_per_month: 100,
            storage_gb: 10
          }
        }

        const limits = planLimits[planType]

        // Count users in customer account
        const { count: userCount } = await supabaseAdmin
          .from('customer_users')
          .select('*', { count: 'exact', head: true })
          .eq('customer_id', customerId)
          .eq('status', 'active')

        // Count suppliers in customer account
        const { count: supplierCount } = await supabaseAdmin
          .from('customer_suppliers')
          .select('*', { count: 'exact', head: true })
          .eq('customer_id', customerId)
          .eq('status', 'active')

        // Count RFQs this month
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        let creatorIds = [customerId]
        const { data: customerUsers } = await supabaseAdmin
          .from('customer_users')
          .select('user_id')
          .eq('customer_id', customerId)
          .eq('status', 'active')
        
        if (customerUsers && customerUsers.length > 0) {
          creatorIds.push(...customerUsers.map(u => u.user_id))
        }

        const { count: rfqCount } = await supabaseAdmin
          .from('projects')
          .select('*', { count: 'exact', head: true })
          .in('created_by', creatorIds)
          .gte('created_at', startOfMonth.toISOString())

        // Calculate storage
        const { data: files, error: filesError } = await supabaseAdmin
          .from('project_files')
          .select('file_size, project:projects!inner(created_by)')
          .in('project.created_by', creatorIds)
          .eq('is_active', true)

        if (filesError) {
          console.error('Storage calculation error:', filesError)
        }

        const totalStorageBytes = files?.reduce((sum, f) => sum + (f.file_size || 0), 0) || 0
        const storageUsedGB = totalStorageBytes / (1024 * 1024 * 1024)

        stats.push({
          customer_id: customerId,
          customer_name: conn.customer?.username || 'Bilinmeyen',
          plan_type: planType,
          limits,
          usage: {
            users: userCount || 0,
            suppliers: supplierCount || 0,
            rfq_this_month: rfqCount || 0,
            storage_gb: parseFloat(storageUsedGB.toFixed(2))
          }
        })
      }

      res.json({ customers: stats })
    } else {
      return res.status(403).json({ error: 'Bu işlem sadece müşteriler ve tedarikçiler için geçerlidir.' })
    }
  } catch (error) {
    console.error('Get usage stats error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

export default router
