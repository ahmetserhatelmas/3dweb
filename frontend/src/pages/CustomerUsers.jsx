import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import API_URL from '../lib/api'
import { 
  LogOut, FileBox, Users as UsersIcon,
  Trash2, Mail, User as UserIcon, Copy, Check, UserPlus, Shield,
  DollarSign, Settings, Sun, Moon
} from 'lucide-react'
import './Users.css'
import './Dashboard.css'

export default function CustomerUsers() {
  const { user, token, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviteCode, setInviteCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [success, setSuccess] = useState('')
  
  // Usage stats
  const [usageStats, setUsageStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)
  
  const isCustomer = user?.role === 'customer'
  const isCustomerAdmin = user?.is_customer_admin
  const basePath = isCustomer ? '/customer' : '/admin'

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    fetchUsers()
    fetchUsageStats()
    if (isCustomerAdmin) {
      fetchInviteCode()
    }
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/my-customer-users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('Fetch users error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchInviteCode = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/my-user-invite-code`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setInviteCode(data.invite_code)
      }
    } catch (error) {
      console.error('Fetch invite code error:', error)
    }
  }

  const fetchUsageStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/my-usage-stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setUsageStats(data)
      }
    } catch (error) {
      console.error('Fetch usage stats error:', error)
    } finally {
      setLoadingStats(false)
    }
  }

  const handleCopyInviteCode = () => {
    navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = async (userId, username) => {
    if (!confirm(`"${username}" kullanıcısını hesaptan çıkarmak istediğinize emin misiniz?`)) {
      return
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/customer-users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }

      setSuccess('Kullanıcı başarıyla hesaptan çıkarıldı!')
      fetchUsers()
      
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      alert(err.message)
    }
  }

  const sidebarNav = (
    <nav className="sidebar-nav">
      <Link to={basePath} className="nav-item">
        <FileBox size={20} />
        <span>Projeler</span>
      </Link>
      <Link to={`${basePath}/suppliers`} className="nav-item">
        <UsersIcon size={20} />
        <span>Tedarikçiler</span>
      </Link>
      <Link to={`${basePath}/users`} className="nav-item active">
        <UserPlus size={20} />
        <span>Kullanıcılar</span>
      </Link>
      <Link to={`${basePath}/archive`} className="nav-item">
        <DollarSign size={20} />
        <span>Arşiv Teklifler</span>
      </Link>
    </nav>
  )

  const sidebarFooter = (
    <div className="sidebar-footer">
      <div className="user-info-wrap" ref={settingsRef}>
        <div className="user-info" onClick={() => setSettingsOpen(o => !o)} style={{ cursor: 'pointer' }}>
          <div className="user-avatar">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <div className="user-details">
            <span className="user-name">{user?.username}</span>
            <span className="user-role-label">{isCustomerAdmin ? 'Müşteri Admin' : 'Müşteri'}</span>
          </div>
          <Settings size={16} className="settings-icon" />
        </div>
        {settingsOpen && (
          <div className="settings-dropdown">
            <button className="settings-dropdown-item" onClick={() => toggleTheme()}>
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
              {theme === 'light' ? 'Karanlık Mod' : 'Aydınlık Mod'}
            </button>
            <div className="settings-dropdown-divider" />
            <button className="settings-dropdown-item danger" onClick={() => { logout(); setSettingsOpen(false) }}>
              <LogOut size={16} />
              Çıkış Yap
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // If not customer admin, show access denied
  if (!isCustomerAdmin) {
    return (
      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <img src="/LOGO.png" alt="Kunye.tech" className="sidebar-logo-img" />
            <span>Kunye.tech</span>
          </div>
          {sidebarNav}
          {sidebarFooter}
        </aside>

        <main className="main-content">
          <div className="page-header">
            <div>
              <h1 className="page-title">Kullanıcılar</h1>
              <p className="page-subtitle">
                Müşteri hesabına bağlı kullanıcıları görüntüleyin
              </p>
            </div>
          </div>

          {/* Show users but without invite code and delete buttons */}
          {loading ? (
            <div className="loading-screen">
              <div className="loading-spinner"></div>
            </div>
          ) : users.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              background: 'var(--card-bg)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)'
            }}>
              <UserPlus size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
              <h3 style={{ marginBottom: '0.5rem' }}>Henüz kullanıcı yok</h3>
              <p style={{ color: 'var(--text-muted)' }}>
                Kullanıcılar eklendiğinde burada görünecek
              </p>
            </div>
          ) : (
            <div className="users-grid stagger-children">
              {users.map(u => (
                <div key={u.id} className="user-card">
                  <div className="user-card-avatar" data-role="customer">
                    {u.username?.charAt(0).toUpperCase()}
                  </div>
                  <div className="user-card-info">
                    <h3 title={u.username}>{u.username}</h3>
                    {u.email && (
                      <p className="user-company" title={u.email}>
                        <Mail size={14} />
                        <span>{u.email}</span>
                      </p>
                    )}
                    {u.joined_at && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        {u.is_admin ? 'Hesap Oluşturma: ' : 'Katılma: '}
                        {new Date(u.joined_at).toLocaleDateString('tr-TR')}
                      </p>
                    )}
                  </div>
                  <div className="user-card-actions" style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'flex-end',
                    gap: '0.5rem',
                    minWidth: 'fit-content'
                  }}>
                    <span className={`role-badge ${u.is_admin ? 'admin' : 'customer'}`}>
                      {u.is_admin ? <Shield size={12} /> : <UserIcon size={12} />}
                      {' '}
                      {u.is_admin ? 'Admin' : 'Kullanıcı'}
                    </span>
                    {/* No delete button for regular users */}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    )
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="/LOGO.png" alt="Kunye.tech" className="sidebar-logo-img" />
          <span>Kunye.tech</span>
        </div>
        {sidebarNav}
        {sidebarFooter}
      </aside>

      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Kullanıcılar</h1>
            <p className="page-subtitle">
              Müşteri hesabınıza kullanıcı ekleyin ve yönetin
            </p>
          </div>
        </div>

        {success && (
          <div className="success-message" style={{ marginBottom: '1.5rem' }}>
            {success}
          </div>
        )}

        {/* Plan Usage Stats */}
        {usageStats && (
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>
                  {usageStats.plan_type === 'business' ? '🏢' : '⚡'}
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>
                    {usageStats.plan_type === 'business' ? 'Business Plan' : 'Starter Plan'}
                  </h3>
                  {usageStats.plan_start_date && (
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Başlangıç: {new Date(usageStats.plan_start_date).toLocaleDateString('tr-TR')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {/* Users */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Kullanıcılar</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                    {usageStats.usage.users} / {usageStats.limits.users}
                  </span>
                </div>
                <div style={{ 
                  height: '8px', 
                  background: 'var(--bg-secondary)', 
                  borderRadius: '4px', 
                  overflow: 'hidden' 
                }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${Math.min((usageStats.usage.users / usageStats.limits.users) * 100, 100)}%`,
                    background: usageStats.usage.users >= usageStats.limits.users ? '#ef4444' : '#3b82f6',
                    transition: 'width 0.3s'
                  }} />
                </div>
              </div>

              {/* Suppliers */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Tedarikçiler</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                    {usageStats.usage.suppliers} / {usageStats.limits.suppliers}
                  </span>
                </div>
                <div style={{ 
                  height: '8px', 
                  background: 'var(--bg-secondary)', 
                  borderRadius: '4px', 
                  overflow: 'hidden' 
                }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${Math.min((usageStats.usage.suppliers / usageStats.limits.suppliers) * 100, 100)}%`,
                    background: usageStats.usage.suppliers >= usageStats.limits.suppliers ? '#ef4444' : '#10b981',
                    transition: 'width 0.3s'
                  }} />
                </div>
              </div>

              {/* RFQ This Month */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>RFQ (Bu Ay)</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                    {usageStats.usage.rfq_this_month} / {usageStats.limits.rfq_per_month}
                  </span>
                </div>
                <div style={{ 
                  height: '8px', 
                  background: 'var(--bg-secondary)', 
                  borderRadius: '4px', 
                  overflow: 'hidden' 
                }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${Math.min((usageStats.usage.rfq_this_month / usageStats.limits.rfq_per_month) * 100, 100)}%`,
                    background: usageStats.usage.rfq_this_month >= usageStats.limits.rfq_per_month ? '#ef4444' : '#f59e0b',
                    transition: 'width 0.3s'
                  }} />
                </div>
              </div>

              {/* Storage */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Depolama</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                    {(() => {
                      const gb = usageStats?.usage?.storage_gb ?? 0
                      const mb = usageStats?.usage?.storage_mb ?? 0
                      const limitGb = usageStats?.limits?.storage_gb ?? 10
                      return `${gb >= 1 ? `${gb} GB` : `${mb} MB`} / ${limitGb} GB`
                    })()}
                  </span>
                </div>
                <div style={{ 
                  height: '8px', 
                  background: 'var(--bg-secondary)', 
                  borderRadius: '4px', 
                  overflow: 'hidden' 
                }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${Math.min(((usageStats?.usage?.storage_gb ?? 0) / (usageStats?.limits?.storage_gb ?? 10)) * 100, 100)}%`,
                    background: (usageStats?.usage?.storage_gb ?? 0) >= (usageStats?.limits?.storage_gb ?? 10) ? '#ef4444' : '#8b5cf6',
                    transition: 'width 0.3s'
                  }} />
                </div>
                {usageStats.usage.storage_unknown && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Eski dosyaların boyutu veritabanında kayıtlı değil; yeni yüklemeler sayılır.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Invite Code Card */}
        <div className="invite-code-card" style={{ 
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <UserPlus size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Kullanıcı Davet Linki</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
            Bu linki kullanıcılarınızla paylaşın. Link üzerinden kayıt olduklarında hesabınıza bağlanacak ve aynı projeleri görebilecekler.
          </p>
          
          {/* Invite Link */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
              Davet Linki
            </label>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <code style={{
                background: 'var(--bg-secondary)',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '0.875rem',
                flex: 1,
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                wordBreak: 'break-all'
              }}>
                {inviteCode ? `${window.location.origin}/invite/${inviteCode}` : 'Yükleniyor...'}
              </code>
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/invite/${inviteCode}`)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? 'Kopyalandı!' : 'Kopyala'}
              </button>
            </div>
          </div>
          
          {/* Invite Code */}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
              Davet Kodu (Manuel Giriş İçin)
            </label>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <code style={{
                background: 'var(--bg-secondary)',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '1.125rem',
                fontWeight: '600',
                letterSpacing: '0.05em',
                flex: 1,
                border: '2px solid var(--primary)',
                color: 'var(--primary)'
              }}>
                {inviteCode || 'Yükleniyor...'}
              </code>
              <button 
                className="btn btn-secondary"
                onClick={handleCopyInviteCode}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                Kodu Kopyala
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-screen">
            <div className="loading-spinner"></div>
          </div>
        ) : users.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            background: 'var(--card-bg)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)'
          }}>
            <UserPlus size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
            <h3 style={{ marginBottom: '0.5rem' }}>Henüz kullanıcı yok</h3>
            <p style={{ color: 'var(--text-muted)' }}>
              Davet linkini paylaşarak kullanıcı ekleyin
            </p>
          </div>
        ) : (
          <div className="users-grid stagger-children">
            {users.map(u => (
              <div key={u.id} className="user-card">
                <div className="user-card-avatar" data-role="customer">
                  {u.username?.charAt(0).toUpperCase()}
                </div>
                <div className="user-card-info">
                  <h3 title={u.username}>{u.username}</h3>
                  {u.email && (
                    <p className="user-company" title={u.email}>
                      <Mail size={14} />
                      <span>{u.email}</span>
                    </p>
                  )}
                  {u.joined_at && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {u.is_admin ? 'Hesap Oluşturma: ' : 'Katılma: '}
                      {new Date(u.joined_at).toLocaleDateString('tr-TR')}
                    </p>
                  )}
                </div>
                <div className="user-card-actions" style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'flex-end',
                  gap: '0.5rem',
                  minWidth: 'fit-content'
                }}>
                  <span className={`role-badge ${u.is_admin ? 'admin' : 'customer'}`}>
                    {u.is_admin ? <Shield size={12} /> : <UserIcon size={12} />}
                    {' '}
                    {u.is_admin ? 'Admin' : 'Kullanıcı'}
                  </span>
                  {!u.is_admin && (
                    <div className="user-card-buttons">
                      <button 
                        className="icon-btn delete-btn" 
                        onClick={() => handleDelete(u.id, u.username)}
                        title="Hesaptan Çıkar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
