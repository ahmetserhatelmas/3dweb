import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { 
  ArrowRight, 
  CheckCircle, 
  Zap, 
  Shield, 
  BarChart3,
  Users,
  FileText,
  Settings,
  Mail,
  Lock,
  User,
  Building2,
  Send,
  MessageSquare
} from 'lucide-react'
import './Home.css'

export default function Home() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  
  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      const redirectMap = {
        admin: '/admin',
        customer: '/customer',
        user: '/dashboard'
      }
      navigate(redirectMap[user.role] || '/', { replace: true })
    }
  }, [user, authLoading, navigate])
  
  const [showLogin, setShowLogin] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [loginUserType, setLoginUserType] = useState('supplier') // 'supplier' or 'customer'
  const [registerUserType, setRegisterUserType] = useState('supplier') // 'supplier' or 'customer'
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [registerForm, setRegisterForm] = useState({ 
    email: '', 
    password: '', 
    username: '', 
    company_name: '' 
  })
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    message: ''
  })
  const [contactLoading, setContactLoading] = useState(false)
  const [contactSuccess, setContactSuccess] = useState(false)
  const [contactError, setContactError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [registrationSuccess, setRegistrationSuccess] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const { login } = useAuth()

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

  const isBusinessEmail = (email) => {
    const domain = email.split('@')[1]?.toLowerCase()
    if (!domain) return false
    return !personalEmailDomains.includes(domain)
  }

  const handleContactSubmit = async (e) => {
    e.preventDefault()
    setContactLoading(true)
    setContactError('')
    setContactSuccess(false)

    // Check for business email
    if (!isBusinessEmail(contactForm.email)) {
      setContactError('Lütfen şirket e-posta adresinizi giriniz. Kişisel e-posta adresleri (Gmail, Hotmail, Yahoo vb.) kabul edilmemektedir.')
      setContactLoading(false)
      return
    }

    try {
      const apiUrl = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${apiUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Mesaj gönderilemedi')
      }

      setContactSuccess(true)
      setContactForm({ name: '', email: '', message: '' })
    } catch (err) {
      setContactError(err.message)
    } finally {
      setContactLoading(false)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const user = await login(loginForm.username, loginForm.password, loginUserType)
      setShowLogin(false)
      navigate(user.role === 'admin' ? '/admin' : user.role === 'customer' ? '/customer' : '/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const apiUrl = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${apiUrl}/api/auth/register-public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...registerForm,
          user_type: registerUserType
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Kayıt başarısız')
      }

      // If email confirmation is required
      if (data.requires_confirmation) {
        setRegisteredEmail(data.email || registerForm.email)
        setShowRegister(false)
        setRegistrationSuccess(true)
        // Reset form
        setRegisterForm({ email: '', password: '', username: '', company_name: '' })
      } else {
        // Development mode - auto login without email confirmation
        await login(registerForm.username, registerForm.password)
        setShowRegister(false)
        navigate('/customer')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="home-page">
      {/* Header */}
      <header className="home-header">
        <div className="header-content">
          <div className="logo-section">
            <img src="/logo.png" alt="Kunye.tech" className="home-logo" />
            <span className="logo-text">Kunye<span className="logo-accent">.tech</span></span>
          </div>
          <nav className="header-nav">
            <a href="#features">Özellikler</a>
            <a href="#benefits">Avantajlar</a>
            <a href="#contact">İletişim</a>
            <button className="btn-text" onClick={() => setShowLogin(true)}>
              Giriş Yap
            </button>
            <button className="btn-primary" onClick={() => setShowRegister(true)}>
              Başlayın
            </button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-background">
          <div className="hero-gradient"></div>
          <div className="hero-pattern"></div>
        </div>
        <div className="hero-content">
          <h1 className="hero-title">
            Üretimin Dijital Pasaportu
            <span className="hero-subtitle">Proje yönetim platformu</span>
          </h1>
          <p className="hero-description">
            Projelerinizi dijitalleştirin, revizyonları yönetin, tedarikçilerle 
            kolayca çalışın. Tüm süreçleri tek bir platformda birleştirin.
          </p>
          <div className="hero-actions">
            <button className="btn-hero-primary" onClick={() => setShowRegister(true)}>
              Ücretsiz Başlayın
              <ArrowRight size={20} />
            </button>
            <button className="btn-hero-secondary" onClick={() => setShowLogin(true)}>
              Giriş Yap
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="section-container">
          <h2 className="section-title">Güçlü Özellikler</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <FileText size={32} />
              </div>
              <h3>Proje Yönetimi</h3>
              <p>Projelerinizi merkezi bir platformda yönetin, dosyalarınızı organize edin ve ilerlemeyi takip edin.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <Settings size={32} />
              </div>
              <h3>Revizyon Yönetimi</h3>
              <p>Geometri ve adet revizyonlarını kolayca yönetin, tedarikçilerle işbirliği yapın.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <Users size={32} />
              </div>
              <h3>Tedarikçi Yönetimi</h3>
              <p>Tedarikçilerinizi yönetin, teklifleri karşılaştırın ve en iyi fiyatları bulun.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <BarChart3 size={32} />
              </div>
              <h3>İlerleme Takibi</h3>
              <p>Proje ilerlemesini gerçek zamanlı olarak takip edin ve raporlar oluşturun.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <Shield size={32} />
              </div>
              <h3>Güvenlik</h3>
              <p>Verileriniz güvende, tüm işlemler şifrelenmiş ve yedeklenmiş.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <Zap size={32} />
              </div>
              <h3>Hızlı ve Kolay</h3>
              <p>Sezgisel arayüz ile hızlıca başlayın, minimum eğitim ile maksimum verimlilik.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="benefits-section">
        <div className="section-container">
          <h2 className="section-title">Neden Kunye.tech?</h2>
          <div className="benefits-list">
            <div className="benefit-item">
              <CheckCircle size={24} />
              <div>
                <h3>Zaman Tasarrufu</h3>
                <p>Manuel süreçleri otomatikleştirin, %40'a kadar zaman tasarrufu sağlayın.</p>
              </div>
            </div>
            <div className="benefit-item">
              <CheckCircle size={24} />
              <div>
                <h3>Maliyet Optimizasyonu</h3>
                <p>Tedarikçi tekliflerini karşılaştırarak en iyi fiyatları bulun.</p>
              </div>
            </div>
            <div className="benefit-item">
              <CheckCircle size={24} />
              <div>
                <h3>Şeffaflık</h3>
                <p>Tüm süreçlerde tam şeffaflık, her adımı takip edin.</p>
              </div>
            </div>
            <div className="benefit-item">
              <CheckCircle size={24} />
              <div>
                <h3>İşbirliği</h3>
                <p>Müşteri ve tedarikçiler arasında sorunsuz iletişim.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="contact-section">
        <div className="section-container">
          <h2 className="section-title">İletişim</h2>
          <p className="contact-subtitle">Sorularınız mı var? Bize ulaşın, size yardımcı olalım.</p>
          
          <div className="contact-content">
            <div className="contact-info">
              <div className="contact-info-item">
                <Mail size={24} />
                <div>
                  <h4>Email</h4>
                  <a href="mailto:info@kunye.tech">info@kunye.tech</a>
                </div>
              </div>
              <div className="contact-info-item">
                <MessageSquare size={24} />
                <div>
                  <h4>Destek</h4>
                  <p>7/24 destek hattımız ile yanınızdayız</p>
                </div>
              </div>
            </div>
            
            <form className="contact-form" onSubmit={handleContactSubmit}>
              {contactError && <div className="error-message">{contactError}</div>}
              {contactSuccess && (
                <div className="success-message">
                  <CheckCircle size={18} />
                  Mesajınız başarıyla gönderildi! En kısa sürede size dönüş yapacağız.
                </div>
              )}
              
              <div className="form-group">
                <label>
                  <User size={18} />
                  Adınız Soyadınız
                </label>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  placeholder="Adınız Soyadınız"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>
                  <Mail size={18} />
                  İş E-posta Adresiniz
                </label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="ornek@sirket.com"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>
                  <MessageSquare size={18} />
                  Mesajınız
                </label>
                <textarea
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  placeholder="Mesajınızı buraya yazın..."
                  rows={5}
                  required
                />
              </div>
              
              <button type="submit" className="btn-submit" disabled={contactLoading}>
                {contactLoading ? 'Gönderiliyor...' : (
                  <>
                    <Send size={18} />
                    Mesaj Gönder
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="section-container">
          <h2>Hemen Başlayın</h2>
          <p>Ücretsiz kaydolun ve projelerinizi dijitalleştirmeye başlayın</p>
          <button className="btn-cta" onClick={() => setShowRegister(true)}>
            Ücretsiz Başlayın
            <ArrowRight size={20} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="footer-content">
          <div className="footer-logo">
            <img src="/logo.png" alt="Kunye.tech" className="footer-logo-img" />
            <span>Kunye.tech</span>
          </div>
          <p className="footer-copyright">&copy; 2026 Kunye.tech. Tüm hakları saklıdır.</p>
          <p className="footer-license">
            This application uses{' '}
            <a href="https://www.opencascade.com/" target="_blank" rel="noopener noreferrer">
              Open CASCADE Technology
            </a>
            , licensed under{' '}
            <a href="https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html" target="_blank" rel="noopener noreferrer">
              LGPL 2.1
            </a>
            .
          </p>
        </div>
      </footer>

      {/* Login Modal */}
      {showLogin && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setShowLogin(false)}>×</button>
            <h2>Giriş Yap</h2>
            
            {/* User Type Tabs */}
            <div className="user-type-tabs">
              <button
                type="button"
                className={`tab-btn ${loginUserType === 'supplier' ? 'active' : ''}`}
                onClick={() => setLoginUserType('supplier')}
              >
                <Users size={16} />
                Tedarikçi Girişi
              </button>
              <button
                type="button"
                className={`tab-btn ${loginUserType === 'customer' ? 'active' : ''}`}
                onClick={() => setLoginUserType('customer')}
              >
                <Building2 size={16} />
                Müşteri Girişi
              </button>
              <button
                type="button"
                className={`tab-btn ${loginUserType === 'admin' ? 'active' : ''}`}
                onClick={() => setLoginUserType('admin')}
              >
                <Shield size={16} />
                Admin Girişi
              </button>
            </div>

            <form onSubmit={handleLogin}>
              {error && <div className="error-message">{error}</div>}
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
              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Register Modal */}
      {showRegister && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setShowRegister(false)}>×</button>
            <h2>Kayıt Ol</h2>
            
            {/* User Type Tabs */}
            <div className="user-type-tabs">
              <button
                type="button"
                className={`tab-btn ${registerUserType === 'supplier' ? 'active' : ''}`}
                onClick={() => setRegisterUserType('supplier')}
              >
                <Users size={16} />
                Tedarikçi Kaydı
              </button>
              <button
                type="button"
                className={`tab-btn ${registerUserType === 'customer' ? 'active' : ''}`}
                onClick={() => setRegisterUserType('customer')}
              >
                <Building2 size={16} />
                Müşteri Kaydı
              </button>
            </div>

            <form onSubmit={handleRegister}>
              {error && <div className="error-message">{error}</div>}
              <div className="form-group">
                <label>
                  <Mail size={18} />
                  Email
                </label>
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>
                  <User size={18} />
                  Kullanıcı Adı
                </label>
                <input
                  type="text"
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>
                  <Building2 size={18} />
                  Şirket Adı (Opsiyonel)
                </label>
                <input
                  type="text"
                  value={registerForm.company_name}
                  onChange={(e) => setRegisterForm({ ...registerForm, company_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>
                  <Lock size={18} />
                  Şifre
                </label>
                <input
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Email Confirmation Success Modal */}
      {registrationSuccess && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setRegistrationSuccess(false)}>×</button>
            <div className="success-content">
              <div className="success-icon">
                <Mail size={48} />
              </div>
              <h2>Email Onayı Gerekli</h2>
              <p>
                <strong>{registeredEmail}</strong> adresine bir onay email'i gönderdik.
              </p>
              <p>
                Lütfen email kutunuzu kontrol edin ve hesabınızı aktifleştirmek için 
                gönderilen linke tıklayın.
              </p>
              <div className="success-actions">
                <button 
                  className="btn-submit" 
                  onClick={() => {
                    setRegistrationSuccess(false)
                    setShowLogin(true)
                  }}
                >
                  Tamam
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

