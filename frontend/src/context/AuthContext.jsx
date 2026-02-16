import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refresh_token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      fetchUser()
    } else {
      setLoading(false)
    }
  }, [token])

  const fetchUser = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${apiUrl}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setUser(data)
      } else if (res.status === 401 || res.status === 403) {
        // Try to refresh token
        if (refreshToken) {
          const refreshed = await tryRefreshToken()
          if (!refreshed) {
            logout()
          }
        } else {
          logout()
        }
      }
    } catch (error) {
      console.error('Fetch user error:', error)
      logout()
    } finally {
      setLoading(false)
    }
  }

  const tryRefreshToken = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${apiUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      })
      if (res.ok) {
        const data = await res.json()
        localStorage.setItem('token', data.token)
        localStorage.setItem('refresh_token', data.refresh_token)
        setToken(data.token)
        setRefreshToken(data.refresh_token)
        return true
      }
    } catch (error) {
      console.error('Refresh token error:', error)
    }
    return false
  }

  // Login with username (for Supabase) - with user_type
  const login = async (username, password, user_type = 'supplier') => {
    const apiUrl = import.meta.env.VITE_API_URL || ''
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, user_type })
    })
    
    const data = await res.json()
    
    if (!res.ok) {
      throw new Error(data.error || 'Giriş başarısız')
    }

    localStorage.setItem('token', data.token)
    if (data.refresh_token) {
      localStorage.setItem('refresh_token', data.refresh_token)
      setRefreshToken(data.refresh_token)
    }
    setToken(data.token)
    setUser(data.user)

    // Check for pending invite codes
    const pendingInviteCode = localStorage.getItem('pending_invite_code')
    const pendingUserInviteCode = localStorage.getItem('pending_user_invite_code')
    
    if (pendingInviteCode && data.user.user_type === 'supplier') {
      try {
        const inviteRes = await fetch(`${apiUrl}/api/auth/accept-invite`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.token}`
          },
          body: JSON.stringify({ invite_code: pendingInviteCode })
        })
        
        if (inviteRes.ok) {
          localStorage.removeItem('pending_invite_code')
          console.log('✅ Supplier invite accepted automatically after login')
        }
      } catch (err) {
        console.error('Auto supplier invite accept failed:', err)
      }
    }
    
    if (pendingUserInviteCode && data.user.user_type === 'customer') {
      try {
        const inviteRes = await fetch(`${apiUrl}/api/auth/accept-user-invite`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.token}`
          },
          body: JSON.stringify({ invite_code: pendingUserInviteCode })
        })
        
        if (inviteRes.ok) {
          localStorage.removeItem('pending_user_invite_code')
          console.log('✅ User invite accepted automatically after login')
        }
      } catch (err) {
        console.error('Auto user invite accept failed:', err)
      }
    }

    return data.user
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    setToken(null)
    setRefreshToken(null)
    setUser(null)
    // Redirect to home page
    window.location.href = '/'
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

