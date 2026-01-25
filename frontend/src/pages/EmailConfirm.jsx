import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { CheckCircle, XCircle, Loader } from 'lucide-react'
import './EmailConfirm.css'

export default function EmailConfirm() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [status, setStatus] = useState('verifying') // verifying, success, error
  const [message, setMessage] = useState('')

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        // Get token from URL
        const token = searchParams.get('token')
        const type = searchParams.get('type')

        if (!token || type !== 'signup') {
          setStatus('error')
          setMessage('Geçersiz onay linki.')
          return
        }

        // Verify email with Supabase
        const apiUrl = import.meta.env.VITE_API_URL || ''
        const res = await fetch(`${apiUrl}/api/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Email onayı başarısız')
        }

        // Success - user is now confirmed
        setStatus('success')
        setMessage('Email adresiniz başarıyla onaylandı!')

        // Auto login after 2 seconds
        setTimeout(async () => {
          try {
            // Try to login with username from response
            if (data.username) {
              await login(data.username, data.password || '')
              navigate('/customer')
            } else {
              navigate('/')
            }
          } catch (err) {
            // If auto login fails, redirect to login
            navigate('/')
          }
        }, 2000)
      } catch (err) {
        console.error('Email verification error:', err)
        setStatus('error')
        setMessage(err.message || 'Email onayı sırasında bir hata oluştu.')
      }
    }

    verifyEmail()
  }, [searchParams, login, navigate])

  return (
    <div className="email-confirm-page">
      <div className="confirm-container">
        {status === 'verifying' && (
          <>
            <Loader className="confirm-icon spinning" size={64} />
            <h1>Email Onaylanıyor...</h1>
            <p>Lütfen bekleyin, email adresiniz doğrulanıyor.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="confirm-icon success" size={64} />
            <h1>Email Onaylandı!</h1>
            <p>{message}</p>
            <p className="redirect-message">Yönlendiriliyorsunuz...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="confirm-icon error" size={64} />
            <h1>Onay Başarısız</h1>
            <p>{message}</p>
            <button className="btn-back" onClick={() => navigate('/')}>
              Ana Sayfaya Dön
            </button>
          </>
        )}
      </div>
    </div>
  )
}

