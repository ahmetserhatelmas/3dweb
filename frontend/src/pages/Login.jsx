import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Lock, User, ArrowRight } from 'lucide-react'
import './Login.css'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const user = await login(username, password)
      navigate(user.role === 'admin' ? '/admin' : user.role === 'customer' ? '/customer' : '/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-background">
        <div className="grid-lines"></div>
        <div className="glow-orb orb-1"></div>
        <div className="glow-orb orb-2"></div>
      </div>
      
      <div className="login-container">
        <div className="login-header">
          <img src="/logo.png" alt="Kunye.tech" className="login-logo" />
          <h1><span className="logo-kunye">Kunye</span><span className="logo-tech">.tech</span></h1>
          <p className="login-slogan">Üretimin Dijital Pasaportu</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="input-group">
            <label htmlFor="username">Kullanıcı Adı</label>
            <div className="input-with-icon">
              <User size={18} />
              <input
                type="text"
                id="username"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Kullanıcı adınızı girin"
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="password">Şifre</label>
            <div className="input-with-icon">
              <Lock size={18} />
              <input
                type="password"
                id="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Şifrenizi girin"
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

      </div>
    </div>
  )
}

