import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import API_URL from '../lib/api'
import { 
  Plus, LogOut, Box, Clock, CheckCircle, 
  Eye, FileBox, Users, Calendar, ChevronRight, UserPlus
} from 'lucide-react'
import './Dashboard.css'

export default function AdminDashboard() {
  const { user, token, logout } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchProjects()
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
          <img src="/logo.png" alt="Kunye.tech" className="sidebar-logo-img" />
          <span>Kunye.tech</span>
        </div>

        <nav className="sidebar-nav">
          <Link to="/admin" className="nav-item active">
            <FileBox size={20} />
            <span>Projeler</span>
          </Link>
          <Link to="/admin/users" className="nav-item">
            <Users size={20} />
            <span>Kullanıcılar</span>
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <span className="user-name">{user?.username}</span>
              <span className="user-role">Admin</span>
            </div>
          </div>
          <button onClick={logout} className="logout-btn" title="Çıkış Yap">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Projeler</h1>
            <p className="page-subtitle">Tedarikçilere atanan işleri yönetin</p>
          </div>
          <Link to="/admin/new-project" className="btn btn-primary">
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
                <p className="project-part">Parça No: {project.part_number}</p>
                
                <div className="project-meta">
                  <div className="meta-item" title="Müşteri">
                    <UserPlus size={16} />
                    <span>{project.creator_username || 'Admin'}</span>
                  </div>
                  <div className="meta-item" title="Tedarikçi">
                    <Users size={16} />
                    <span>{project.supplier_name || 'Atanmamış'}</span>
                  </div>
                  {project.deadline && (
                    <div className="meta-item" title="Son Tarih">
                      <Calendar size={16} />
                      <span>{new Date(project.deadline).toLocaleDateString('tr-TR')}</span>
                    </div>
                  )}
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

