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
      const res = await fetch('/api/auth/me', {
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
      const res = await fetch('/api/auth/refresh', {
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

  // Login with username (for Supabase)
  const login = async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
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
    return data.user
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    setToken(null)
    setRefreshToken(null)
    setUser(null)
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

