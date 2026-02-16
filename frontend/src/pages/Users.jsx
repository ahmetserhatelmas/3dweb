import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import API_URL from '../lib/api'
import { 
  Plus, LogOut, Box, Users as UsersIcon, FileBox, 
  Trash2, Building2, Mail, Shield, User as UserIcon, Edit2, Settings
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
  const [editingUser, setEditingUser] = useState(null)
  
  // Plan management
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null) // { user, current_plan }
  const [selectedPlan, setSelectedPlan] = useState('starter')
  const [updatingPlan, setUpdatingPlan] = useState(false)
  
  const isCustomer = user?.role === 'customer'
  const basePath = isCustomer ? '/customer' : '/admin'
  
  const [form, setForm] = useState({
    username: '',
    password: '',
    role: 'user',
    company_name: ''
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/users`, {
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
      if (editingUser) {
        // Update user
        const updateData = {
          username: form.username,
          role: form.role,
          company_name: form.company_name
        }
        
        // Sadece şifre girilmişse ekle
        if (form.password && form.password.trim() !== '') {
          updateData.password = form.password
        }
        
        const res = await fetch(`${API_URL}/api/auth/users/${editingUser.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updateData)
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Kullanıcı güncellenemedi')
        }

        setSuccess('Kullanıcı başarıyla güncellendi!')
      } else {
        // Create user
        const res = await fetch(`${API_URL}/api/auth/register`, {
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
      }
      
      setForm({
        username: '',
        password: '',
        role: 'user',
        company_name: ''
      })
      setEditingUser(null)
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

  const handleEdit = (u) => {
    setEditingUser(u)
    setForm({
      username: u.username,
      password: '',
      role: u.role,
      company_name: u.company_name || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (userId, username) => {
    if (isCustomer) {
      // Müşteri için: sadece bağı kaldır
      if (!confirm(`"${username}" tedarikçisini listenizden çıkarmak istediğinize emin misiniz? (Tedarikçi hesabı silinmeyecek, sadece sizinle bağı koparılacak)`)) {
        return
      }
    } else {
      // Admin için: kullanıcıyı tamamen sil
      if (!confirm(`"${username}" kullanıcısını silmek istediğinize emin misiniz?`)) {
        return
      }
    }

    try {
      if (isCustomer) {
        // Müşteri-tedarikçi bağını kaldır
        const res = await fetch(`${API_URL}/api/auth/suppliers/${userId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error)
        }

        setSuccess('Tedarikçi listenizden çıkarıldı!')
      } else {
        // Admin: Kullanıcıyı tamamen sil
        const res = await fetch(`${API_URL}/api/auth/users/${userId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error)
        }

        setSuccess('Kullanıcı başarıyla silindi!')
      }
      
      fetchUsers()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      alert(err.message)
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingUser(null)
    setForm({
      username: '',
      password: '',
      role: 'user',
      company_name: ''
    })
    setError('')
    setSuccess('')
  }

  const handleOpenPlanModal = (u) => {
    setEditingPlan({ user: u, current_plan: u.plan_type || 'starter' })
    setSelectedPlan(u.plan_type || 'starter')
    setShowPlanModal(true)
  }

  const handleUpdatePlan = async () => {
    if (!editingPlan) return
    
    setUpdatingPlan(true)
    setError('')

    try {
      const res = await fetch(`${API_URL}/api/auth/customers/${editingPlan.user.id}/plan`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan_type: selectedPlan })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Plan güncellenemedi')
      }

      setSuccess('Plan başarıyla güncellendi!')
      fetchUsers()
      
      setTimeout(() => {
        setShowPlanModal(false)
        setEditingPlan(null)
        setSuccess('')
      }, 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdatingPlan(false)
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
          <Link to={basePath} className="nav-item">
            <FileBox size={20} />
            <span>Projeler</span>
          </Link>
          <Link to={`${basePath}/suppliers`} className="nav-item active">
            <UsersIcon size={20} />
            <span>{isCustomer ? 'Tedarikçiler' : 'Kullanıcılar'}</span>
          </Link>
          {isCustomer && (
            <Link to={`${basePath}/users`} className="nav-item">
              <UsersIcon size={20} />
              <span>Kullanıcılar</span>
            </Link>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <span className="user-name">{user?.username}</span>
              <span className="user-role">{isCustomer ? 'Müşteri' : 'Admin'}</span>
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
            <h1 className="page-title">{isCustomer ? 'Tedarikçiler' : 'Kullanıcılar'}</h1>
            <p className="page-subtitle">
              {isCustomer ? 'Tedarikçilerinizi yönetin' : 'Sistem kullanıcılarını yönetin'}
            </p>
          </div>
          {!isCustomer && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={20} />
              Yeni Kullanıcı
            </button>
          )}
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
                  {u.username?.charAt(0).toUpperCase()}
                </div>
                <div className="user-card-info">
                  <h3>{u.username}</h3>
                  {u.company_name && (
                    <p className="user-company">
                      <Building2 size={14} />
                      {u.company_name}
                    </p>
                  )}
                  {/* Show plan info for customer admins (admin view only) */}
                  {!isCustomer && u.role === 'customer' && u.is_customer_admin && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        background: u.plan_type === 'business' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: u.plan_type === 'business' ? '#f59e0b' : '#3b82f6',
                        border: `1px solid ${u.plan_type === 'business' ? 'rgba(251, 191, 36, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
                      }}>
                        {u.plan_type === 'business' ? '🏢 Business' : '⚡ Starter'}
                      </span>
                      {u.plan_start_date && (
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          Başlangıç: {new Date(u.plan_start_date).toLocaleDateString('tr-TR')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="user-card-actions">
                <span className={`role-badge ${u.role}`}>
                  {u.role === 'admin' ? (
                    <><Shield size={12} /> Admin</>
                    ) : u.role === 'customer' ? (
                      <><Building2 size={12} /> Müşteri</>
                  ) : (
                    <><UserIcon size={12} /> Tedarikçi</>
                  )}
                </span>
                  {u.id !== user.id && (
                    <div className="user-card-buttons">
                      {!isCustomer && u.role === 'customer' && u.is_customer_admin && (
                        <button 
                          className="icon-btn" 
                          onClick={() => handleOpenPlanModal(u)}
                          title="Plan Değiştir"
                          style={{
                            background: 'rgba(251, 191, 36, 0.15)',
                            color: '#f59e0b',
                            border: '1px solid rgba(251, 191, 36, 0.3)'
                          }}
                        >
                          <Settings size={16} />
                        </button>
                      )}
                      {!isCustomer && (
                        <button 
                          className="icon-btn edit-btn" 
                          onClick={() => handleEdit(u)}
                          title="Düzenle"
                        >
                          <Edit2 size={16} />
                        </button>
                      )}
                      {/* Only show delete button for: admins OR customer admins (not regular customer users) */}
                      {(!isCustomer || user?.is_customer_admin) && (
                        <button 
                          className="icon-btn delete-btn" 
                          onClick={() => handleDelete(u.id, u.username)}
                          title={isCustomer ? "Tedarikçiyi Listeden Çıkar" : "Sil"}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={handleCloseModal}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingUser ? 'Kullanıcıyı Düzenle' : (isCustomer ? 'Yeni Tedarikçi Oluştur' : 'Yeni Kullanıcı Oluştur')}</h2>
                <button className="modal-close" onClick={handleCloseModal}>×</button>
              </div>
              
              <form onSubmit={handleSubmit} className="modal-body">
                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                <div className="input-group">
                  <label>Kullanıcı Adı *</label>
                  <input
                    type="text"
                    className="input"
                    value={form.username}
                    onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Kullanıcı adı"
                    required
                    disabled={editingUser}
                  />
                </div>

                {!editingUser ? (
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
                ) : (
                <div className="input-group">
                    <label>Yeni Şifre (opsiyonel)</label>
                  <input
                      type="password"
                    className="input"
                      value={form.password}
                      onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Değiştirmek için yeni şifre girin"
                      minLength={6}
                    />
                    <small style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Boş bırakırsanız şifre değişmez
                    </small>
                </div>
                )}

                <div className="input-group">
                  <label>Rol *</label>
                  <select
                    className="input"
                    value={form.role}
                    onChange={e => setForm(prev => ({ ...prev, role: e.target.value }))}
                    disabled={isCustomer}
                  >
                    <option value="user">Tedarikçi</option>
                    {!isCustomer && <option value="customer">Müşteri</option>}
                    {!isCustomer && <option value="admin">Admin</option>}
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
                  <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                    İptal
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={creating}>
                    {creating ? 'Kaydediliyor...' : (editingUser ? 'Güncelle' : (isCustomer ? 'Tedarikçi Oluştur' : 'Kullanıcı Oluştur'))}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Plan Modal */}
        {showPlanModal && editingPlan && (
          <div className="modal-overlay" onClick={() => setShowPlanModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h2>Plan Değiştir - {editingPlan.user.username}</h2>
                <button className="modal-close" onClick={() => setShowPlanModal(false)}>×</button>
              </div>
              
              <div className="modal-body">
                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                <div style={{ display: 'grid', gap: '1rem' }}>
                  {/* Starter Plan */}
                  <div 
                    onClick={() => setSelectedPlan('starter')}
                    style={{
                      padding: '1.5rem',
                      border: `2px solid ${selectedPlan === 'starter' ? '#3b82f6' : 'var(--border-color)'}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      background: selectedPlan === 'starter' ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-card)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>⚡</span>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>Starter</h3>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Mikro firma, deneme
                        </p>
                      </div>
                    </div>
                    <ul style={{ margin: 0, padding: '0 0 0 1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      <li>3 Kullanıcı</li>
                      <li>10 Tedarikçi</li>
                      <li>10 RFQ/ay</li>
                      <li>1 GB Depolama</li>
                    </ul>
                  </div>

                  {/* Business Plan */}
                  <div 
                    onClick={() => setSelectedPlan('business')}
                    style={{
                      padding: '1.5rem',
                      border: `2px solid ${selectedPlan === 'business' ? '#f59e0b' : 'var(--border-color)'}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      background: selectedPlan === 'business' ? 'rgba(251, 191, 36, 0.05)' : 'var(--bg-card)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>🏢</span>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>Business</h3>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Ana segment (5-50 çalışan)
                        </p>
                      </div>
                    </div>
                    <ul style={{ margin: 0, padding: '0 0 0 1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      <li>10 Kullanıcı</li>
                      <li>40 Tedarikçi</li>
                      <li>100 RFQ/ay</li>
                      <li>10 GB Depolama</li>
                    </ul>
                  </div>
                </div>

                <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowPlanModal(false)}>
                    İptal
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    disabled={updatingPlan || selectedPlan === editingPlan.current_plan}
                    onClick={handleUpdatePlan}
                  >
                    {updatingPlan ? 'Güncelleniyor...' : 'Planı Güncelle'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}


