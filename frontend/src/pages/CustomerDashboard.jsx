import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import API_URL from '../lib/api'
import { 
  Plus, LogOut, Box, Clock, CheckCircle, 
  Eye, FileBox, Users, Calendar, ChevronRight, UserPlus, Copy, Check, Link as LinkIcon,
  LayoutGrid, List, DollarSign, Settings, Sun, Moon, User
} from 'lucide-react'
import { formatDeadlineInfo } from '../utils/dateUtils'
import RecentActivities from '../components/RecentActivities'
import './Dashboard.css'

export default function CustomerDashboard() {
  const { user, token, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef(null)
  const [projects, setProjects] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [filter, setFilter] = useState('all')
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list'
  const [copiedInvite, setCopiedInvite] = useState(false)
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
    fetchSuppliers()
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

  const fetchSuppliers = async () => {
    setLoadingSuppliers(true)
    try {
      const res = await fetch(`${API_URL}/api/auth/my-suppliers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setSuppliers(data)
      }
    } catch (error) {
      console.error('Fetch suppliers error:', error)
    } finally {
      setLoadingSuppliers(false)
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

  const copyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/invite/${user.invite_code}`
    navigator.clipboard.writeText(inviteUrl)
    setCopiedInvite(true)
    setTimeout(() => setCopiedInvite(false), 2000)
  }

  const filteredProjects = projects.filter(p => {
    if (filter === 'all') return true
    return p.status === filter
  })

  const stats = {
    total: projects.length,
    pending: projects.filter(p => p.status === 'pending').length,
    reviewing: projects.filter(p => p.status === 'reviewing').length,
    completed: projects.filter(p => p.status === 'completed').length
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { label: 'Bekliyor', class: 'badge-pending' },
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
          <Link to="/customer" className="nav-item active">
            <FileBox size={20} />
            <span>Projeler</span>
          </Link>
          <Link to="/customer/suppliers" className="nav-item">
            <Users size={20} />
            <span>Tedarikçiler</span>
          </Link>
          <Link to="/customer/users" className="nav-item">
            <UserPlus size={20} />
            <span>Kullanıcılar</span>
          </Link>
          <Link to="/customer/archive" className="nav-item">
            <DollarSign size={20} />
            <span>Arşiv Teklifler</span>
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info-wrap" ref={settingsRef}>
            <div className="user-info" onClick={() => setSettingsOpen(o => !o)} style={{ cursor: 'pointer', flex: 1 }}>
              <div className="user-avatar">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div className="user-details">
                <span className="user-name">{user?.username}</span>
                <span className="user-role-label">Müşteri</span>
              </div>
              <Settings size={16} className="settings-icon" />
            </div>
            {settingsOpen && (
              <div className="settings-dropdown">
                <Link
                  to="/profile"
                  className="settings-dropdown-item"
                  onClick={() => setSettingsOpen(false)}
                  style={{ textDecoration: 'none' }}
                >
                  <User size={16} />
                  Profilim
                </Link>
                <div className="settings-dropdown-divider" />
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
      </aside>

      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Projeler</h1>
            <p className="page-subtitle">Tedarikçilerinize atanan işleri yönetin</p>
          </div>
          <Link to="/customer/new-project" className="btn btn-primary">
            <Plus size={20} />
            Yeni Proje
          </Link>
        </div>

        <div className="stats-grid stagger-children">
          <div className="stat-card">
            <div className="stat-icon total">
              <FileBox size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">Toplam Proje</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon pending">
              <Clock size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.pending}</span>
              <span className="stat-label">Bekleyen</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon reviewing">
              <Eye size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.reviewing}</span>
              <span className="stat-label">İnceleniyor</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon completed">
              <CheckCircle size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{stats.completed}</span>
              <span className="stat-label">Tamamlandı</span>
            </div>
          </div>
        </div>

        {/* Plan Usage Stats - always visible, skeleton while loading */}
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
                {usageStats ? (usageStats.plan_type === 'business' ? '🏢' : '⚡') : '—'}
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>
                  {usageStats ? (usageStats.plan_type === 'business' ? 'Business Plan' : 'Starter Plan') : 'Plan'}
                </h3>
                {usageStats?.plan_start_date ? (
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Başlangıç: {new Date(usageStats.plan_start_date).toLocaleDateString('tr-TR')}
                  </p>
                ) : loadingStats ? (
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', opacity: 0.6 }}>Yükleniyor...</p>
                ) : null}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {/* Users */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Kullanıcılar</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                  {usageStats ? `${usageStats.usage.users} / ${usageStats.limits.users}` : '—'}
                </span>
              </div>
              <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: usageStats ? `${Math.min((usageStats.usage.users / usageStats.limits.users) * 100, 100)}%` : '0%',
                  background: usageStats && usageStats.usage.users >= usageStats.limits.users ? '#ef4444' : '#3b82f6',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>

            {/* Suppliers */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Tedarikçiler</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                  {usageStats ? `${usageStats.usage.suppliers} / ${usageStats.limits.suppliers}` : '—'}
                </span>
              </div>
              <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: usageStats ? `${Math.min((usageStats.usage.suppliers / usageStats.limits.suppliers) * 100, 100)}%` : '0%',
                  background: usageStats && usageStats.usage.suppliers >= usageStats.limits.suppliers ? '#ef4444' : '#10b981',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>

            {/* RFQ This Month */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>RFQ (Bu Ay)</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                  {usageStats ? `${usageStats.usage.rfq_this_month} / ${usageStats.limits.rfq_per_month}` : '—'}
                </span>
              </div>
              <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: usageStats ? `${Math.min((usageStats.usage.rfq_this_month / usageStats.limits.rfq_per_month) * 100, 100)}%` : '0%',
                  background: usageStats && usageStats.usage.rfq_this_month >= usageStats.limits.rfq_per_month ? '#ef4444' : '#f59e0b',
                  transition: 'width 0.3s'
                }} />
              </div>
            </div>

            {/* Storage */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Depolama</span>
                <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                  {usageStats ? (() => {
                    const gb = usageStats.usage.storage_gb ?? 0
                    const mb = usageStats.usage.storage_mb ?? 0
                    const limitGb = usageStats.limits.storage_gb ?? 10
                    const used = gb >= 1 ? `${gb} GB` : `${mb} MB`
                    return `${used} / ${limitGb} GB`
                  })() : '—'}
                </span>
              </div>
              <div style={{ height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: usageStats ? `${Math.min(((usageStats.usage.storage_gb ?? 0) / (usageStats.limits.storage_gb ?? 10)) * 100, 100)}%` : '0%',
                  background: usageStats && (usageStats.usage.storage_gb ?? 0) >= (usageStats.limits.storage_gb ?? 10) ? '#ef4444' : '#8b5cf6',
                  transition: 'width 0.3s'
                }} />
              </div>
              {usageStats?.usage?.storage_unknown && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Eski dosyaların boyutu veritabanında kayıtlı değil; yeni yüklemeler sayılır.
                </div>
              )}
            </div>
          </div>
        </div>

        <RecentActivities />

        <div className="filter-tabs-row">
          <div className="filter-tabs">
            <button 
              className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Tümü ({stats.total})
            </button>
            <button 
              className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
              onClick={() => setFilter('pending')}
            >
              Bekleyen ({stats.pending})
            </button>
            <button 
              className={`filter-tab ${filter === 'reviewing' ? 'active' : ''}`}
              onClick={() => setFilter('reviewing')}
            >
              İnceleniyor ({stats.reviewing})
            </button>
            <button 
              className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
              onClick={() => setFilter('completed')}
            >
              Tamamlandı ({stats.completed})
            </button>
          </div>
          <div className="view-toggle" title={viewMode === 'grid' ? 'Izgara görünümü' : 'Liste görünümü'}>
            <button
              type="button"
              className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              aria-label="Izgara görünümü"
            >
              <LayoutGrid size={20} />
            </button>
            <button
              type="button"
              className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              aria-label="Liste görünümü"
            >
              <List size={20} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-screen">
            <div className="loading-spinner"></div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="empty-state">
            <FileBox className="empty-state-icon" />
            <h3 className="empty-state-title">Henüz proje yok</h3>
            <p>İlk projenizi oluşturmak için "Yeni Proje" butonuna tıklayın.</p>
          </div>
        ) : (
          <div className={`stagger-children ${viewMode === 'list' ? 'projects-list' : 'projects-grid'}`}>
            {filteredProjects.map(project => (
              <Link to={`/project/${project.id}`} key={project.id} className={`project-card ${viewMode === 'list' ? 'project-card-list' : ''}`}>
                <div className="project-card-header">
                  <span className={`badge ${getStatusBadge(project.status).class}`}>
                    {getStatusBadge(project.status).label}
                  </span>
                  <ChevronRight size={20} className="card-arrow" />
                </div>
                
                <h3 className="project-name">
                  {project.name}
                  {project.current_revision && (
                    <span className="revision-badge" title="Aktif Revizyon">
                      Rev. {project.current_revision}
                    </span>
                  )}
                </h3>
                
                <div className="project-meta">
                  <div className="meta-item">
                    <Users size={16} />
                    <span>
                      {project.project_suppliers && project.project_suppliers.length > 0 ? (
                        project.status === 'pending' && project.is_quotation ? (
                          project.project_suppliers.map(ps => ps.supplier?.company_name || ps.supplier?.username).join(', ')
                        ) : (
                          project.project_suppliers.find(ps => ps.status === 'accepted')?.supplier?.company_name ||
                          project.project_suppliers.find(ps => ps.status === 'accepted')?.supplier?.username ||
                          project.supplier_name ||
                          'Atanmamış'
                        )
                      ) : (
                        project.supplier_name || 'Atanmamış'
                      )}
                    </span>
                  </div>
                  {project.deadline && (
                    <div className={`meta-item deadline ${formatDeadlineInfo(project.deadline)?.urgency || ''}`}>
                      <Calendar size={16} />
                      <span>
                        Termin: {new Date(project.deadline).toLocaleDateString('tr-TR')}
                        <strong className="days-remaining"> ({formatDeadlineInfo(project.deadline)?.daysStr})</strong>
                      </span>
                    </div>
                  )}
                  {(() => {
                    const accepted = project.project_suppliers?.find(ps => ps.status === 'accepted')
                    if (!accepted?.quoted_price) return null
                    return (
                      <div className="meta-item price">
                        <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#10b981' }}>
                          Fiyat: {accepted.quoted_price.toLocaleString('tr-TR')}₺
                        </span>
                      </div>
                    )
                  })()}
                </div>

                {project.total_items > 0 && (
                  <div className="project-progress">
                    <div className="progress-header">
                      <span>İlerleme</span>
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


