import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Lock, User, Shield } from 'lucide-react'
import './AdminLogin.css'

export default function AdminLogin() {
  const { user, loading: authLoading, login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === 'admin') {
        navigate('/admin', { replace: true })
      } else {
        const redirectMap = { customer: '/customer', user: '/dashboard' }
        navigate(redirectMap[user.role] || '/', { replace: true })
      }
    }
  }, [user, authLoading, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const loggedUser = await login(form.username, form.password, 'admin')
      if (loggedUser?.role !== 'admin') {
        setError('Bu hesap admin yetkisine sahip değil.')
      }
    } catch (err) {
      setError(err.message || 'Giriş başarısız.')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="admin-login-page">
        <div className="loading-spinner" />
      </div>
    )
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-box">
        <div className="admin-login-icon">
          <Shield size={32} />
        </div>
        <h1 className="admin-login-title">Admin Girişi</h1>
        <p className="admin-login-subtitle">Künye yönetim paneline erişmek için giriş yapın.</p>

        <form onSubmit={handleSubmit} className="admin-login-form">
          {error && <div className="admin-login-error">{error}</div>}

          <div className="admin-field">
            <label>
              <User size={16} />
              Kullanıcı adı veya e-posta
            </label>
            <input
              type="text"
              autoComplete="username"
              placeholder="admin kullanıcı adı"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>

          <div className="admin-field">
            <label>
              <Lock size={16} />
              Şifre
            </label>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <button type="submit" className="admin-login-btn" disabled={loading}>
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  )
}
