import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { 
  Plus, LogOut, Box, Users as UsersIcon, FileBox, 
  Trash2, Building2, Mail, Shield, User as UserIcon
} from 'lucide-react'
import './Users.css'

export default function Users() {
  const { user, token, logout } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [form, setForm] = useState({
    email: '',
    password: '',
    username: '',
    role: 'user',
    company_name: ''
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/auth/users', {
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setCreating(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(form)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Kullanıcı oluşturulamadı')
      }

      setSuccess('Kullanıcı başarıyla oluşturuldu!')
      setForm({
        email: '',
        password: '',
        username: '',
        role: 'user',
        company_name: ''
      })
      fetchUsers()
      
      setTimeout(() => {
        setShowModal(false)
        setSuccess('')
      }, 1500)

    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Box size={24} />
          </div>
          <span>Künye</span>
        </div>

        <nav className="sidebar-nav">
          <Link to="/admin" className="nav-item">
            <FileBox size={20} />
            <span>Projeler</span>
          </Link>
          <Link to="/admin/users" className="nav-item active">
            <UsersIcon size={20} />
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
            <h1 className="page-title">Kullanıcılar</h1>
            <p className="page-subtitle">Sistem kullanıcılarını yönetin</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={20} />
            Yeni Kullanıcı
          </button>
        </div>

        {loading ? (
          <div className="loading-screen">
            <div className="loading-spinner"></div>
          </div>
        ) : (
          <div className="users-grid stagger-children">
            {users.map(u => (
              <div key={u.id} className="user-card">
                <div className="user-card-avatar" data-role={u.role}>
                  {u.username?.charAt(0).toUpperCase() || u.email?.charAt(0).toUpperCase()}
                </div>
                <div className="user-card-info">
                  <h3>{u.username || u.email}</h3>
                  <p className="user-email">
                    <Mail size={14} />
                    {u.email}
                  </p>
                  {u.company_name && (
                    <p className="user-company">
                      <Building2 size={14} />
                      {u.company_name}
                    </p>
                  )}
                </div>
                <span className={`role-badge ${u.role}`}>
                  {u.role === 'admin' ? (
                    <><Shield size={12} /> Admin</>
                  ) : (
                    <><UserIcon size={12} /> Tedarikçi</>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Yeni Kullanıcı Oluştur</h2>
                <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
              </div>
              
              <form onSubmit={handleSubmit} className="modal-body">
                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                <div className="input-group">
                  <label>E-posta *</label>
                  <input
                    type="email"
                    className="input"
                    value={form.email}
                    onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="ornek@firma.com"
                    required
                  />
                </div>

                <div className="input-group">
                  <label>Şifre *</label>
                  <input
                    type="password"
                    className="input"
                    value={form.password}
                    onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Minimum 6 karakter"
                    minLength={6}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>Kullanıcı Adı</label>
                  <input
                    type="text"
                    className="input"
                    value={form.username}
                    onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Görünen isim"
                  />
                </div>

                <div className="input-group">
                  <label>Rol *</label>
                  <select
                    className="input"
                    value={form.role}
                    onChange={e => setForm(prev => ({ ...prev, role: e.target.value }))}
                  >
                    <option value="user">Tedarikçi</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>Firma Adı</label>
                  <input
                    type="text"
                    className="input"
                    value={form.company_name}
                    onChange={e => setForm(prev => ({ ...prev, company_name: e.target.value }))}
                    placeholder="Firma Ltd. Şti."
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    İptal
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={creating}>
                    {creating ? 'Oluşturuluyor...' : 'Kullanıcı Oluştur'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}


