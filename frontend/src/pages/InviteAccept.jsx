import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import API_URL from '../lib/api'
import { UserPlus, CheckCircle, XCircle, Loader, Mail, User, Lock, Users } from 'lucide-react'
import './InviteAccept.css'

export default function InviteAccept() {
  const { inviteCode } = useParams()
  const navigate = useNavigate()
  const { user, token, login } = useAuth()
  const [status, setStatus] = useState('loading') // loading, success, error, login_required
  const [message, setMessage] = useState('')
  const [customerInfo, setCustomerInfo] = useState(null)
  const [showRegister, setShowRegister] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [registerForm, setRegisterForm] = useState({ email: '', username: '', password: '' })
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [formError, setFormError] = useState('')
  const [formLoading, setFormLoading] = useState(false)
  const [inviteType, setInviteType] = useState(null) // 'supplier' or 'user'

  useEffect(() => {
    // Determine invite type and save to localStorage
    if (inviteCode) {
      // USER- prefix for customer user invites, otherwise supplier invite
      const type = inviteCode.startsWith('USER-') ? 'user' : 'supplier'
      setInviteType(type)
      
      if (type === 'supplier') {
        localStorage.setItem('pending_invite_code', inviteCode)
      } else {
        localStorage.setItem('pending_user_invite_code', inviteCode)
      }
    }
    
    // Fetch customer info first
    fetchCustomerInfo()
    
    handleInvite()
  }, [inviteCode, user])

  const fetchCustomerInfo = async () => {
    if (!inviteCode) return
    
    const type = inviteCode.startsWith('USER-') ? 'user' : 'supplier'
    const endpoint = type === 'supplier' ? 'validate-invite' : 'validate-user-invite'
    
    try {
      const res = await fetch(`${API_URL}/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: inviteCode })
      })
      
      if (res.ok) {
        const data = await res.json()
        setCustomerInfo(data.customer)
      }
    } catch (error) {
      console.error('Validate invite error:', error)
    }
  }

  const handleInvite = async () => {
    // Check if user is logged in
    if (!user || !token) {
      const type = inviteCode.startsWith('USER-') ? 'user' : 'supplier'
      setStatus('login_required')
      setMessage(
        type === 'supplier' 
          ? 'Davet kodunu kullanmak için önce tedarikçi olarak giriş yapmalısınız.'
          : 'Davet kodunu kullanmak için önce müşteri olarak giriş yapmalısınız.'
      )
      return
    }

    const type = inviteCode.startsWith('USER-') ? 'user' : 'supplier'

    // Check user type matches invite type
    if (type === 'supplier' && user.user_type !== 'supplier') {
      setStatus('error')
      setMessage('Sadece tedarikçi hesapları bu davet kodunu kullanabilir.')
      return
    }

    if (type === 'user' && user.user_type !== 'customer') {
      setStatus('error')
      setMessage('Sadece müşteri hesapları bu davet kodunu kullanabilir.')
      return
    }

    // Accept the invite
    const endpoint = type === 'supplier' ? 'accept-invite' : 'accept-user-invite'
    const storageKey = type === 'supplier' ? 'pending_invite_code' : 'pending_user_invite_code'
    const redirectPath = type === 'supplier' ? '/dashboard' : '/customer'

    try {
      const res = await fetch(`${API_URL}/api/auth/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ invite_code: inviteCode })
      })

      const data = await res.json()

      if (!res.ok) {
        // Check if already connected
        if (data.error?.includes('zaten bağlısınız') || data.error?.includes('already connected')) {
          setStatus('error')
          setMessage('Bu müşteri hesabına zaten bağlısınız. Dashboard\'a yönlendiriliyorsunuz...')
          localStorage.removeItem(storageKey)
          setTimeout(() => {
            navigate(redirectPath)
          }, 2000)
          return
        }
        
        setStatus('error')
        setMessage(data.error || 'Davet kodu kabul edilemedi.')
        return
      }

      // Clear pending invite
      localStorage.removeItem(storageKey)

      setStatus('success')
      setCustomerInfo(data.customer)
      setMessage(
        type === 'supplier'
          ? `${data.customer.company_name || data.customer.username} ile başarıyla bağlandınız!`
          : `${data.customer.company_name || data.customer.username} hesabına başarıyla katıldınız!`
      )
      
      // Redirect after 3 seconds
      setTimeout(() => {
        navigate(redirectPath)
      }, 3000)
    } catch (error) {
      console.error('Accept invite error:', error)
      setStatus('error')
      setMessage('Bir hata oluştu. Lütfen tekrar deneyin.')
    }
  }

  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)

    const type = inviteCode.startsWith('USER-') ? 'user' : 'supplier'
    const userType = type === 'supplier' ? 'supplier' : 'customer'

    try {
      const res = await fetch(`${API_URL}/api/auth/register-public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...registerForm,
          user_type: userType
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Kayıt başarısız')
      }

      // Auto login
      await login(registerForm.username, registerForm.password, userType)
      
      // Page will re-render and accept invite automatically
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    setFormLoading(true)

    const type = inviteCode.startsWith('USER-') ? 'user' : 'supplier'
    const userType = type === 'supplier' ? 'supplier' : 'customer'

    try {
      await login(loginForm.username, loginForm.password, userType)
      // Page will re-render and accept invite automatically
    } catch (err) {
      setFormError(err.message)
    } finally {
      setFormLoading(false)
    }
  }

  return (
    <div className="invite-accept-page">
      <div className="invite-container">
        {status === 'loading' && (
          <div className="invite-status loading">
            <Loader size={64} className="spinning" />
            <h2>Davet kodu kontrol ediliyor...</h2>
          </div>
        )}

        {status === 'success' && (
          <div className="invite-status success">
            <div className="success-icon-wrapper">
              <CheckCircle size={64} />
            </div>
            <h2>Bağlantı Başarılı!</h2>
            <p>{message}</p>
            {customerInfo && (
              <div className="customer-info-box">
                <UserPlus size={20} />
                <div>
                  <p className="customer-name">{customerInfo.company_name || customerInfo.username}</p>
                  <p className="customer-detail">ile artık çalışabilirsiniz</p>
                </div>
              </div>
            )}
            <p className="redirect-hint">Dashboard'a yönlendiriliyorsunuz...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="invite-status error">
            <XCircle size={64} />
            <h2>Bağlantı Kurulamadı</h2>
            <p>{message}</p>
            <button className="btn-back" onClick={() => navigate('/dashboard')}>
              Dashboard'a Dön
            </button>
          </div>
        )}

        {status === 'login_required' && (
          <div className="invite-status login-required">
            <UserPlus size={64} />
            <h2>Giriş veya Kayıt Olun</h2>
            
            {customerInfo && (
              <div className="customer-info-preview">
                <Users size={20} />
                <div>
                  <p className="customer-name-preview">{customerInfo.company_name || customerInfo.username}</p>
                  <p className="invite-message">
                    {inviteType === 'supplier' 
                      ? 'sizi tedarikçisi olarak eklemek istiyor' 
                      : 'hesabına kullanıcı olarak katılmanızı istiyor'}
                  </p>
                </div>
              </div>
            )}
            
            <p>{message}</p>
            
            <div className="invite-forms">
              {/* Login Form */}
              {!showRegister && (
                <div className="auth-form">
                  <h3>{inviteType === 'supplier' ? 'Tedarikçi Girişi' : 'Müşteri Girişi'}</h3>
                  <form onSubmit={handleLoginSubmit}>
                    {formError && <div className="form-error">{formError}</div>}
                    <div className="form-group">
                      <label>
                        <User size={18} />
                        Kullanıcı Adı
                      </label>
                      <input
                        type="text"
                        value={loginForm.username}
                        onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>
                        <Lock size={18} />
                        Şifre
                      </label>
                      <input
                        type="password"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                        required
                      />
                    </div>
                    <button type="submit" className="btn-primary" disabled={formLoading}>
                      {formLoading ? 'Giriş yapılıyor...' : 'Giriş Yap ve Bağlan'}
                    </button>
                  </form>
                  <button 
                    className="btn-link" 
                    onClick={() => setShowRegister(true)}
                  >
                    Hesabınız yok mu? Kayıt olun
                  </button>
                </div>
              )}

              {/* Register Form */}
              {showRegister && (
                <div className="auth-form">
                  <h3>{inviteType === 'supplier' ? 'Tedarikçi Kaydı' : 'Kullanıcı Kaydı'}</h3>
                  <form onSubmit={handleRegisterSubmit}>
                    {formError && <div className="form-error">{formError}</div>}
                    <div className="form-group">
                      <label>
                        <Mail size={18} />
                        Email *
                      </label>
                      <input
                        type="email"
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                        placeholder="ornek@email.com"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>
                        <User size={18} />
                        Kullanıcı Adı *
                      </label>
                      <input
                        type="text"
                        value={registerForm.username}
                        onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                        placeholder="Kullanıcı adınızı girin"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>
                        <Lock size={18} />
                        Şifre * (En az 6 karakter)
                      </label>
                      <input
                        type="password"
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                    </div>
                    <button type="submit" className="btn-primary" disabled={formLoading}>
                      {formLoading ? 'Kayıt yapılıyor...' : 'Kayıt Ol ve Bağlan'}
                    </button>
                  </form>
                  <button 
                    className="btn-link" 
                    onClick={() => setShowRegister(false)}
                  >
                    Zaten hesabınız var mı? Giriş yapın
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
