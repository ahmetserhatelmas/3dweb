import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import API_URL from '../lib/api'
import { 
  LogOut, FileBox, Send, Users, Building2, Calendar, User
} from 'lucide-react'
import './Dashboard.css'

export default function CustomersPage() {
  const { user, token, logout } = useAuth()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [pendingQuotationsCount, setPendingQuotationsCount] = useState(0)

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
          <img src="/logo.png" alt="Kunye.tech" className="sidebar-logo-img" />
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
