import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './ResetPassword.css'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [invalidLink, setInvalidLink] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setInvalidLink(true)
      return
    }
    const hash = window.location.hash
    if (!hash) {
      setInvalidLink(true)
      return
    }
    const params = new URLSearchParams(hash.slice(1))
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    const type = params.get('type')
    if (type !== 'recovery' || !access_token) {
      setInvalidLink(true)
      return
    }
    supabase.auth.setSession({ access_token, refresh_token: refresh_token || '' })
      .then(() => {
        setSessionReady(true)
        window.history.replaceState(null, '', window.location.pathname)
      })
      .catch(() => setInvalidLink(true))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.')
      return
    }
    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor.')
      return
    }
    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setSuccess(true)
      setTimeout(() => navigate('/', { replace: true }), 2500)
    } catch (err) {
      setError(err.message || 'Şifre güncellenemedi.')
    } finally {
      setLoading(false)
    }
  }

  if (!supabase) {
    return (
      <div className="reset-password-page">
        <div className="reset-password-box">
          <p>Supabase yapılandırması eksik.</p>
          <a href="/">Ana sayfaya dön</a>
        </div>
      </div>
    )
  }

  if (invalidLink) {
    return (
      <div className="reset-password-page">
        <div className="reset-password-box">
          <h1>Geçersiz veya süresi dolmuş link</h1>
          <p>Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş. Lütfen giriş ekranından tekrar &quot;Şifremi unuttum&quot; ile yeni link isteyin.</p>
          <a href="/" className="reset-link-btn">Ana sayfaya dön</a>
        </div>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div className="reset-password-page">
        <div className="reset-password-box">
          <p>Yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="reset-password-page">
        <div className="reset-password-box success-box">
          <h1>Şifre güncellendi</h1>
          <p>Yeni şifrenizle giriş yapabilirsiniz. Ana sayfaya yönlendiriliyorsunuz...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="reset-password-page">
      <div className="reset-password-box">
        <h1>Yeni şifre belirleyin</h1>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label>
              <Lock size={18} />
              Yeni şifre
            </label>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="En az 6 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="form-group">
            <label>
              <Lock size={18} />
              Şifre (tekrar)
            </label>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Şifrenizi tekrar girin"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? 'Kaydediliyor...' : 'Şifreyi güncelle'}
          </button>
        </form>
        <a href="/" className="reset-back-link">Ana sayfaya dön</a>
      </div>
    </div>
  )
}
