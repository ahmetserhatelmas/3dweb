import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { 
  LogOut, Box, Clock, CheckCircle, 
  Eye, FileBox, Calendar, ChevronRight, Building2
} from 'lucide-react'
import './Dashboard.css'

export default function UserDashboard() {
  const { user, token, logout } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects', {
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
          <img src="/logo.png" alt="Kunye.tech" className="sidebar-logo-img" />
          <span>Kunye.tech</span>
        </div>

        <nav className="sidebar-nav">
          <Link to="/dashboard" className="nav-item active">
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
                <p className="project-part">Parça No: {project.part_number}</p>
                
                <div className="project-meta">
                  {project.deadline && (
                    <div className="meta-item deadline">
                      <Calendar size={16} />
                      <span>Termin: {new Date(project.deadline).toLocaleDateString('tr-TR')}</span>
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


