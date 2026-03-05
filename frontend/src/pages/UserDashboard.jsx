import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useTheme } from '../context/ThemeContext'
import API_URL from '../lib/api'
import { 
  LogOut, Box, Clock, CheckCircle, 
  Eye, FileBox, Calendar, ChevronRight, Building2, Send, Users, Key, Plus,
  Settings, Sun, Moon
} from 'lucide-react'
import { formatDeadlineInfo } from '../utils/dateUtils'
import './Dashboard.css'

export default function UserDashboard() {
  const { user, token, logout } = useAuth()
  const { showToast } = useToast()
  const { theme, toggleTheme } = useTheme()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef(null)
  const [projects, setProjects] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [filter, setFilter] = useState('pending')
  const [pendingQuotationsCount, setPendingQuotationsCount] = useState(0)
  const [inviteCode, setInviteCode] = useState('')
  const [joiningCustomer, setJoiningCustomer] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [showInviteSection, setShowInviteSection] = useState(false)
  
  // Usage stats
  const [usageStats, setUsageStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)

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
    fetchProjects()
    fetchPendingQuotationsCount()
    fetchCustomers()
    fetchUsageStats()
  }, [])

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_URL}/api/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setProjects(data)
      }
    } catch (error) {
      console.error('Fetch projects error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingQuotationsCount = async () => {
    try {
      const res = await fetch(`${API_URL}/api/projects/quotations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        const pendingCount = data.filter(q => q.status === 'pending').length
        setPendingQuotationsCount(pendingCount)
      }
    } catch (error) {
      console.error('Fetch quotations error:', error)
    }
  }

  const fetchCustomers = async () => {
    setLoadingCustomers(true)
    try {
      const res = await fetch(`${API_URL}/api/auth/my-customers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setCustomers(data)
      }
    } catch (error) {
      console.error('Fetch customers error:', error)
    } finally {
      setLoadingCustomers(false)
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

  const handleJoinCustomer = async (e) => {
    e.preventDefault()
    setInviteError('')
    setJoiningCustomer(true)

    try {
      const res = await fetch(`${API_URL}/api/auth/accept-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ invite_code: inviteCode })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Davet kodu kabul edilemedi')
      }

      showToast(`${data.customer.company_name || data.customer.username} ile bağlantı kuruldu!`, 'success')
      setInviteCode('')
      fetchCustomers() // Refresh customer list
    } catch (err) {
      setInviteError(err.message)
    } finally {
      setJoiningCustomer(false)
    }
  }

  const pendingProjects = projects.filter(p => p.status !== 'completed')
  const completedProjects = projects.filter(p => p.status === 'completed')

  const filteredProjects = filter === 'pending' ? pendingProjects : completedProjects

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { label: 'Yeni İş', class: 'badge-pending' },
      reviewing: { label: 'İnceleniyor', class: 'badge-reviewing' },
      completed: { label: 'Tamamlandı', class: 'badge-completed' }
    }
    return statusMap[status] || statusMap.pending
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="/LOGO.png" alt="Kunye.tech" className="sidebar-logo-img" />
          <span>Kunye.tech</span>
        </div>

        <nav className="sidebar-nav">
          <Link to="/quotations" className="nav-item">
            <Send size={20} />
            <span>Teklifler</span>
            {pendingQuotationsCount > 0 && (
              <span className="nav-badge">{pendingQuotationsCount}</span>
            )}
          </Link>
          <Link to="/dashboard" className="nav-item active">
            <FileBox size={20} />
            <span>İşlerim</span>
          </Link>
          <Link to="/customers" className="nav-item">
            <Users size={20} />
            <span>Müşterilerim</span>
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info-wrap" ref={settingsRef}>
            <div className="user-info" onClick={() => setSettingsOpen(o => !o)} style={{ cursor: 'pointer', flex: 1 }}>
              <div className="user-avatar user">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div className="user-details">
                <span className="user-name">{user?.username}</span>
                <span className="user-role-label">Tedarikçi</span>
              </div>
              <Settings size={16} className="settings-icon" />
            </div>
            {settingsOpen && (
              <div className="settings-dropdown">
                <button className="settings-dropdown-item" onClick={() => { toggleTheme() }}>
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
      </aside>

      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">İşlerim</h1>
            <p className="page-subtitle">Size atanan işleri görüntüleyin ve tamamlayın</p>
          </div>
        </div>

        <div className="stats-grid user-stats stagger-children">
          <div className="stat-card highlight">
            <div className="stat-icon pending">
              <Clock size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{pendingProjects.length}</span>
              <span className="stat-label">Bekleyen İş</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon completed">
              <CheckCircle size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{completedProjects.length}</span>
              <span className="stat-label">Tamamlanan</span>
            </div>
          </div>
        </div>

        {/* Plan Usage Stats - Per Customer */}
        {usageStats?.customers && usageStats.customers.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ 
              fontSize: '1rem', 
              fontWeight: '600', 
              marginBottom: '1rem',
              color: 'var(--text-primary)'
            }}>
              Müşteri Planları ve Kullanım
            </h3>
            {usageStats.customers.map((customerStat) => (
              <div 
                key={customerStat.customer_id}
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  marginBottom: '1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>
                      {customerStat.plan_type === 'business' ? '🏢' : '⚡'}
                    </span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
                        {customerStat.customer_name}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {customerStat.plan_type === 'business' ? 'Business Plan' : 'Starter Plan'}
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                  {/* Users */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Kullanıcı</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>
                        {customerStat.usage.users}/{customerStat.limits.users}
                      </span>
                    </div>
                    <div style={{ 
                      height: '6px', 
                      background: 'var(--bg-secondary)', 
                      borderRadius: '3px', 
                      overflow: 'hidden' 
                    }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${Math.min((customerStat.usage.users / customerStat.limits.users) * 100, 100)}%`,
                        background: customerStat.usage.users >= customerStat.limits.users ? '#ef4444' : '#3b82f6',
                        transition: 'width 0.3s'
                      }} />
                    </div>
                  </div>

                  {/* Suppliers */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tedarikçi</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>
                        {customerStat.usage.suppliers}/{customerStat.limits.suppliers}
                      </span>
                    </div>
                    <div style={{ 
                      height: '6px', 
                      background: 'var(--bg-secondary)', 
                      borderRadius: '3px', 
                      overflow: 'hidden' 
                    }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${Math.min((customerStat.usage.suppliers / customerStat.limits.suppliers) * 100, 100)}%`,
                        background: customerStat.usage.suppliers >= customerStat.limits.suppliers ? '#ef4444' : '#10b981',
                        transition: 'width 0.3s'
                      }} />
                    </div>
                  </div>

                  {/* RFQ This Month */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>RFQ (Ay)</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>
                        {customerStat.usage.rfq_this_month}/{customerStat.limits.rfq_per_month}
                      </span>
                    </div>
                    <div style={{ 
                      height: '6px', 
                      background: 'var(--bg-secondary)', 
                      borderRadius: '3px', 
                      overflow: 'hidden' 
                    }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${Math.min((customerStat.usage.rfq_this_month / customerStat.limits.rfq_per_month) * 100, 100)}%`,
                        background: customerStat.usage.rfq_this_month >= customerStat.limits.rfq_per_month ? '#ef4444' : '#f59e0b',
                        transition: 'width 0.3s'
                      }} />
                    </div>
                  </div>

                  {/* Storage */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Depolama</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>
                        {customerStat.usage.storage_gb >= 1
                        ? `${customerStat.usage.storage_gb} GB`
                        : (customerStat.usage.storage_mb > 0 ? `${customerStat.usage.storage_mb} MB` : '0 MB')
                      }/{customerStat.limits.storage_gb} GB
                      </span>
                    </div>
                    <div style={{ 
                      height: '6px', 
                      background: 'var(--bg-secondary)', 
                      borderRadius: '3px', 
                      overflow: 'hidden' 
                    }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${Math.min((customerStat.usage.storage_gb / customerStat.limits.storage_gb) * 100, 100)}%`,
                        background: customerStat.usage.storage_gb >= customerStat.limits.storage_gb ? '#ef4444' : '#8b5cf6',
                        transition: 'width 0.3s'
                      }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Customer Connection Section */}
        <div className="invite-section">
          <button 
            className="invite-toggle"
            onClick={() => setShowInviteSection(!showInviteSection)}
          >
            <Key size={18} />
            <span>Müşteri Bağlantısı</span>
            <ChevronRight size={18} className={showInviteSection ? 'rotated' : ''} />
          </button>
          
          {showInviteSection && (
            <div className="invite-content">
              <div className="invite-info">
                <Building2 size={20} className="invite-icon" />
                <div>
                  <h3>Müşterilerinizle Bağlanın</h3>
                  <p>Müşterinizden aldığınız davet kodunu girerek bağlantı kurun.</p>
                </div>
              </div>
              
              <form onSubmit={handleJoinCustomer} className="invite-form">
                {inviteError && <div className="error-message">{inviteError}</div>}
                <div className="form-row">
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="INV-XXXXXXXXXXXX"
                    className="invite-code-input"
                    required
                  />
                  <button 
                    type="submit" 
                    className="btn-join-customer"
                    disabled={joiningCustomer || !inviteCode}
                  >
                    <Plus size={18} />
                    {joiningCustomer ? 'Bağlanıyor...' : 'Bağlan'}
                  </button>
                </div>
              </form>

              {loadingCustomers ? (
                <div className="loading-suppliers">Yükleniyor...</div>
              ) : customers.length > 0 ? (
                <div className="connected-suppliers">
                  <h4>Bağlı Müşteriler ({customers.length})</h4>
                  <div className="suppliers-list">
                    {customers.map(customer => (
                      <div key={customer.relationship_id} className="supplier-item">
                        <Building2 size={16} />
                        <div className="supplier-details">
                          <span className="supplier-name">{customer.customer_username}</span>
                          <span className="supplier-company">{customer.customer_company}</span>
                        </div>
                        <span className="supplier-status active">Aktif</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="no-suppliers">
                  <Users size={32} />
                  <p>Henüz bağlı müşteriniz yok</p>
                  <p className="hint">Müşterinizden davet kodu alarak bağlantı kurun</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            <Clock size={16} />
            Bekleyenler ({pendingProjects.length})
          </button>
          <button 
            className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            <CheckCircle size={16} />
            Tamamlananlar ({completedProjects.length})
          </button>
        </div>

        {loading ? (
          <div className="loading-screen">
            <div className="loading-spinner"></div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="empty-state">
            <FileBox className="empty-state-icon" />
            <h3 className="empty-state-title">
              {filter === 'pending' ? 'Bekleyen iş yok' : 'Tamamlanan iş yok'}
            </h3>
            <p>
              {filter === 'pending' 
                ? 'Henüz size atanmış bekleyen iş bulunmuyor.' 
                : 'Henüz tamamladığınız iş bulunmuyor.'}
            </p>
          </div>
        ) : (
          <div className="projects-grid stagger-children">
            {filteredProjects.map(project => (
              <Link to={`/project/${project.id}`} key={project.id} className="project-card">
                <div className="project-card-header">
                  <span className={`badge ${getStatusBadge(project.status).class}`}>
                    {getStatusBadge(project.status).label}
                  </span>
                  <ChevronRight size={20} className="card-arrow" />
                </div>
                
                <h3 className="project-name">{project.name}</h3>
                
                <div className="project-meta">
                  {project.deadline && (
                    <div className={`meta-item deadline ${formatDeadlineInfo(project.deadline)?.urgency || ''}`}>
                      <Calendar size={16} />
                      <span>
                        Termin: {new Date(project.deadline).toLocaleDateString('tr-TR')}
                        <strong className="days-remaining"> ({formatDeadlineInfo(project.deadline)?.daysStr})</strong>
                      </span>
                    </div>
                  )}
                  {/* Show accepted quotation price */}
                  {project.accepted_quoted_price && (
                    <div className="meta-item price">
                      <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#10b981' }}>
                        Fiyat: {project.accepted_quoted_price.toLocaleString('tr-TR')}₺
                      </span>
                    </div>
                  )}
                </div>

                {project.total_items > 0 && (
                  <div className="project-progress">
                    <div className="progress-header">
                      <span>Kontrol Listesi</span>
                      <span>{project.checked_items || 0} / {project.total_items}</span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className="progress-bar-fill" 
                        style={{ width: `${((project.checked_items || 0) / project.total_items) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}


