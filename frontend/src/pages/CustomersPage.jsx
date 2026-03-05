import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import API_URL from '../lib/api'
import { 
  LogOut, FileBox, Send, Users, Building2, Calendar, User,
  Settings, Sun, Moon
} from 'lucide-react'
import './Dashboard.css'

export default function CustomersPage() {
  const { user, token, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef(null)
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [pendingQuotationsCount, setPendingQuotationsCount] = useState(0)

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
    fetchCustomers()
    fetchPendingQuotationsCount()
  }, [])

  const fetchCustomers = async () => {
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
          <Link to="/dashboard" className="nav-item">
            <FileBox size={20} />
            <span>İşlerim</span>
          </Link>
          <Link to="/customers" className="nav-item active">
            <Users size={20} />
            <span>Müşterilerim</span>
            {customers.length > 0 && (
              <span className="nav-badge-info">{customers.length}</span>
            )}
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
            <h1 className="page-title">Müşterilerim</h1>
            <p className="page-subtitle">Bağlı olduğunuz müşterileri görüntüleyin</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <p>Müşteriler yükleniyor...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="empty-state">
            <Users size={64} strokeWidth={1} />
            <h3>Henüz Müşteriniz Yok</h3>
            <p>Müşterilerden davet kodu alarak bağlantı kurabilirsiniz.</p>
            <Link to="/dashboard" className="btn-primary">
              Dashboard'a Dön
            </Link>
          </div>
        ) : (
          <div className="customers-grid">
            {customers.map((customer) => (
              <div key={customer.relationship_id} className="customer-card">
                <div className="customer-header">
                  <div className="customer-avatar">
                    <Building2 size={32} />
                  </div>
                  <div className="customer-info">
                    <h3 className="customer-name">
                      {customer.customer_company || customer.customer_username}
                    </h3>
                    <span className="customer-status active">
                      Aktif Müşteri
                    </span>
                  </div>
                </div>

                <div className="customer-details">
                  <div className="customer-detail-item">
                    <User size={16} />
                    <span>{customer.customer_username}</span>
                  </div>

                  <div className="customer-detail-item">
                    <Calendar size={16} />
                    <span>
                      Bağlantı: {new Date(customer.created_at).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                </div>

                <div className="customer-actions">
                  <Link 
                    to={`/quotations?customer=${customer.customer_id}`} 
                    className="btn-secondary"
                  >
                    <Send size={16} />
                    Teklifler
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
