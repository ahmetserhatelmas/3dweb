import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import API_URL from '../lib/api'
import { 
  FileText, Calendar, Building2, Clock, ChevronRight, 
  Send, CheckCircle, XCircle, DollarSign, Box, LogOut, FileBox
} from 'lucide-react'
import { formatDeadlineInfo } from '../utils/dateUtils'
import './Quotations.css'
import './Dashboard.css'

export default function Quotations() {
  const { user, token, logout } = useAuth()
  const [quotations, setQuotations] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, pending, quoted
  const location = useLocation()

  // Refetch every time the page is visited
  useEffect(() => {
    const fetchQuotations = async () => {
      try {
        console.log('Fetching quotations...')
        const res = await fetch(`${API_URL}/api/projects/quotations`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        console.log('Response status:', res.status)
        if (res.ok) {
          const data = await res.json()
          console.log('Quotations data:', data)
          setQuotations(data)
        } else {
          const errorText = await res.text()
          console.error('Quotations error response:', errorText)
        }
      } catch (error) {
        console.error('Fetch quotations error:', error)
      } finally {
        setLoading(false)
      }
    }

    setLoading(true)
    fetchQuotations()
  }, [location.pathname, token])

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return { label: 'Teklif Bekliyor', class: 'badge-pending', icon: Clock }
      case 'quoted':
        return { label: 'Teklif Verildi', class: 'badge-quoted', icon: Send }
      case 'accepted':
        return { label: 'Kabul Edildi', class: 'badge-accepted', icon: CheckCircle }
      case 'rejected':
        return { label: 'Reddedildi', class: 'badge-rejected', icon: XCircle }
      default:
        return { label: 'Bekliyor', class: 'badge-pending', icon: Clock }
    }
  }

  const filteredQuotations = quotations.filter(q => {
    if (filter === 'all') return true
    return q.status === filter
  })

  const pendingCount = quotations.filter(q => q.status === 'pending').length
  const quotedCount = quotations.filter(q => q.status === 'quoted').length

  if (loading) {
    return (
      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-header">
            <img src="/logo.png" alt="Kunye.tech" className="sidebar-logo-img" />
            <span>Kunye.tech</span>
          </div>
          <nav className="sidebar-nav">
            <Link to="/quotations" className="nav-item active">
              <Send size={20} />
              <span>Teklifler</span>
            </Link>
            <Link to="/dashboard" className="nav-item">
              <FileBox size={20} />
              <span>İşlerim</span>
            </Link>
          </nav>
        </aside>
        <main className="main-content">
          <div className="loading-screen">
            <div className="loading-spinner"></div>
            <p>Teklifler yükleniyor...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="/logo.png" alt="Kunye.tech" className="sidebar-logo-img" />
          <span>Kunye.tech</span>
        </div>

        <nav className="sidebar-nav">
          <Link to="/quotations" className="nav-item active">
            <Send size={20} />
            <span>Teklifler</span>
          </Link>
          <Link to="/dashboard" className="nav-item">
            <FileBox size={20} />
            <span>İşlerim</span>
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar user">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <span className="user-name">{user?.username}</span>
              <span className="user-company">
                <Building2 size={12} />
                {user?.company_name}
              </span>
            </div>
          </div>
          <button onClick={logout} className="logout-btn" title="Çıkış Yap">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="quotations-header">
          <div>
            <h1>Teklif İstekleri</h1>
            <p>Müşterilerden gelen teklif isteklerini görüntüleyin ve teklifinizi gönderin</p>
          </div>
        </header>

      {/* Stats */}
      <div className="quotation-stats">
        <div className="stat-card">
          <div className="stat-icon pending">
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{pendingCount}</span>
            <span className="stat-label">Teklif Bekleyen</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon quoted">
            <Send size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-value">{quotedCount}</span>
            <span className="stat-label">Teklif Verilmiş</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        <button 
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Tümü ({quotations.length})
        </button>
        <button 
          className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          <Clock size={16} />
          Bekleyenler ({pendingCount})
        </button>
        <button 
          className={`filter-tab ${filter === 'quoted' ? 'active' : ''}`}
          onClick={() => setFilter('quoted')}
        >
          <Send size={16} />
          Teklif Verilenler ({quotedCount})
        </button>
      </div>

      {/* Quotations List */}
      {filteredQuotations.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} />
          <h3>Teklif isteği bulunmuyor</h3>
          <p>Müşterilerden gelen teklif istekleri burada görünecek</p>
        </div>
      ) : (
        <div className="quotations-grid">
          {filteredQuotations.map((q) => {
            const StatusIcon = getStatusBadge(q.status).icon
            return (
              <Link 
                key={q.id} 
                to={`/quotation/${q.project.id}`}
                className="quotation-card"
              >
                <div className="quotation-card-header">
                  <span className={`badge ${getStatusBadge(q.status).class}`}>
                    <StatusIcon size={14} />
                    {getStatusBadge(q.status).label}
                  </span>
                  <ChevronRight size={20} className="card-arrow" />
                </div>

                <h3 className="quotation-name">{q.project.name}</h3>

                <div className="quotation-meta">
                  <div className="meta-item">
                    <Building2 size={16} />
                    <span>{q.project.creator_name || 'Müşteri'}</span>
                  </div>
                  {q.project.deadline && (
                    <div className={`meta-item deadline ${formatDeadlineInfo(q.project.deadline)?.urgency || ''}`}>
                      <Calendar size={16} />
                      <span>
                        Termin: {new Date(q.project.deadline).toLocaleDateString('tr-TR')}
                        <strong className="days-remaining"> ({formatDeadlineInfo(q.project.deadline)?.daysStr})</strong>
                      </span>
                    </div>
                  )}
                </div>

                {/* File Count */}
                {q.project.project_files && q.project.project_files.length > 0 && (
                  <div className="quotation-files">
                    <Box size={16} />
                    <span>{q.project.project_files.length} dosya</span>
                  </div>
                )}

                {/* If quoted, show price */}
                {q.status === 'quoted' && q.quoted_price && (
                  <div className="quotation-price">
                    <DollarSign size={16} />
                    <span>Teklifiniz: ₺{Number(q.quoted_price).toLocaleString('tr-TR')}</span>
                  </div>
                )}

                <div className="quotation-footer">
                  {q.status === 'pending' ? (
                    <span className="action-hint">Teklif vermek için tıklayın</span>
                  ) : (
                    <span className="quoted-date">
                      Teklif: {new Date(q.quoted_at).toLocaleDateString('tr-TR')}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
      </main>
    </div>
  )
}

