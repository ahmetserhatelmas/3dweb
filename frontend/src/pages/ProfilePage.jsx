import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import API_URL from '../lib/api'
import {
  User, Building2, Mail, Calendar, Shield, Package,
  Zap, CheckCircle, ArrowLeft, LogOut, Settings,
  Sun, Moon, FileBox, Users, UserPlus, DollarSign,
  Send, BarChart2, Clock
} from 'lucide-react'
import './Dashboard.css'
import './ProfilePage.css'

const PLAN_LIMITS = {
  starter: { users: 3, suppliers: 5, rfq_per_month: 10, storage_gb: 2 },
  business: { users: 10, suppliers: 40, rfq_per_month: 100, storage_gb: 10 },
}

function UsageBar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const over = value >= max
  return (
    <div className="profile-usage-bar-wrap">
      <div className="profile-usage-bar-bg">
        <div
          className="profile-usage-bar-fill"
          style={{ width: `${pct}%`, background: over ? '#ef4444' : color }}
        />
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { user, token, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef(null)
  const [usageStats, setUsageStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)

  const isCustomer = user?.role === 'customer'
  const isSupplier = user?.role === 'user'

  const backPath = isCustomer ? '/customer' : '/dashboard'

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
    fetchUsageStats()
  }, [])

  const fetchUsageStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/my-usage-stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) setUsageStats(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingStats(false)
    }
  }

  const planLabel = (type) => type === 'business' ? 'Business Plan' : 'Starter Plan'
  const planIcon = (type) => type === 'business' ? '🏢' : '⚡'

  const joinDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="/LOGO.png" alt="Kunye.tech" className="sidebar-logo-img" />
          <span>Kunye.tech</span>
        </div>

        <nav className="sidebar-nav">
          {isCustomer ? (
            <>
              <Link to="/customer" className="nav-item">
                <FileBox size={20} /><span>Projeler</span>
              </Link>
              <Link to="/customer/suppliers" className="nav-item">
                <Users size={20} /><span>Tedarikçiler</span>
              </Link>
              <Link to="/customer/users" className="nav-item">
                <UserPlus size={20} /><span>Kullanıcılar</span>
              </Link>
              <Link to="/customer/archive" className="nav-item">
                <DollarSign size={20} /><span>Arşiv Teklifler</span>
              </Link>
            </>
          ) : (
            <>
              <Link to="/quotations" className="nav-item">
                <Send size={20} /><span>Teklifler</span>
              </Link>
              <Link to="/dashboard" className="nav-item">
                <FileBox size={20} /><span>İşlerim</span>
              </Link>
              <Link to="/customers" className="nav-item">
                <Users size={20} /><span>Müşterilerim</span>
              </Link>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info-wrap" ref={settingsRef}>
            <div
              className="user-info"
              onClick={() => setSettingsOpen(o => !o)}
              style={{ cursor: 'pointer', flex: 1 }}
            >
              <div className={`user-avatar ${isSupplier ? 'user' : ''}`}>
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div className="user-details">
                <span className="user-name">{user?.username}</span>
                <span className="user-role-label">{isCustomer ? 'Müşteri' : 'Tedarikçi'}</span>
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
                <button className="settings-dropdown-item" onClick={toggleTheme}>
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

      {/* Main */}
      <main className="main-content">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="profile-back-btn" onClick={() => navigate(backPath)}>
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="page-title">Profilim</h1>
              <p className="page-subtitle">Hesap bilgileriniz ve plan detayları</p>
            </div>
          </div>
        </div>

        <div className="profile-grid">
          {/* Left column — user info */}
          <div className="profile-col">
            {/* Avatar + name card */}
            <div className="profile-card profile-identity-card">
              <div className={`profile-avatar-lg ${isSupplier ? 'supplier' : ''}`}>
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div className="profile-identity-info">
                <h2 className="profile-username">{user?.username}</h2>
                {user?.company_name && (
                  <p className="profile-company">
                    <Building2 size={14} />
                    {user.company_name}
                  </p>
                )}
                <span className={`profile-role-badge ${isCustomer ? 'customer' : 'supplier'}`}>
                  {isCustomer ? 'Müşteri' : 'Tedarikçi'}
                </span>
              </div>
            </div>

            {/* Details */}
            <div className="profile-card">
              <h3 className="profile-section-title">
                <User size={16} />
                Hesap Bilgileri
              </h3>
              <div className="profile-detail-list">
                <div className="profile-detail-row">
                  <span className="profile-detail-label">
                    <User size={14} />
                    Kullanıcı Adı
                  </span>
                  <span className="profile-detail-value">{user?.username}</span>
                </div>
                {user?.company_name && (
                  <div className="profile-detail-row">
                    <span className="profile-detail-label">
                      <Building2 size={14} />
                      Şirket Adı
                    </span>
                    <span className="profile-detail-value">{user.company_name}</span>
                  </div>
                )}
                <div className="profile-detail-row">
                  <span className="profile-detail-label">
                    <Shield size={14} />
                    Hesap Tipi
                  </span>
                  <span className="profile-detail-value">
                    {isCustomer ? 'Müşteri' : 'Tedarikçi'}
                    {user?.is_customer_admin && (
                      <span className="profile-admin-badge">Admin</span>
                    )}
                  </span>
                </div>
                {joinDate && (
                  <div className="profile-detail-row">
                    <span className="profile-detail-label">
                      <Calendar size={14} />
                      Üyelik Tarihi
                    </span>
                    <span className="profile-detail-value">{joinDate}</span>
                  </div>
                )}
                {user?.invite_code && isCustomer && (
                  <div className="profile-detail-row">
                    <span className="profile-detail-label">
                      <Mail size={14} />
                      Davet Kodu
                    </span>
                    <span className="profile-detail-value profile-mono">{user.invite_code}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column — plan & usage */}
          <div className="profile-col">
            {isCustomer && (
              <div className="profile-card profile-plan-card">
                {loadingStats ? (
                  <div className="profile-plan-skeleton">
                    <div className="profile-skeleton-line medium" />
                    <div className="profile-skeleton-line short" />
                  </div>
                ) : usageStats ? (
                  <>
                    <div className="profile-plan-header">
                      <span className="profile-plan-emoji">{planIcon(usageStats.plan_type)}</span>
                      <div>
                        <h3 className="profile-plan-name">{planLabel(usageStats.plan_type)}</h3>
                        {usageStats.plan_start_date && (
                          <p className="profile-plan-since">
                            Başlangıç: {new Date(usageStats.plan_start_date).toLocaleDateString('tr-TR')}
                          </p>
                        )}
                      </div>
                      <span className={`profile-plan-badge ${usageStats.plan_type}`}>
                        {usageStats.plan_type === 'business' ? 'Business' : 'Starter'}
                      </span>
                    </div>

                    <h4 className="profile-section-title" style={{ marginTop: '1.5rem' }}>
                      <BarChart2 size={16} />
                      Kullanım
                    </h4>

                    <div className="profile-usage-list">
                      {[
                        {
                          label: 'Kullanıcılar',
                          value: usageStats.usage.users,
                          max: usageStats.limits.users,
                          color: '#3b82f6',
                        },
                        {
                          label: 'Tedarikçiler',
                          value: usageStats.usage.suppliers,
                          max: usageStats.limits.suppliers,
                          color: '#10b981',
                        },
                        {
                          label: 'RFQ (Bu Ay)',
                          value: usageStats.usage.rfq_this_month,
                          max: usageStats.limits.rfq_per_month,
                          color: '#f59e0b',
                        },
                        {
                          label: 'Depolama',
                          value: (() => {
                            const gb = usageStats.usage.storage_gb ?? 0
                            const mb = usageStats.usage.storage_mb ?? 0
                            return gb >= 1 ? `${gb} GB` : `${mb} MB`
                          })(),
                          valueNum: usageStats.usage.storage_gb ?? 0,
                          max: usageStats.limits.storage_gb,
                          maxLabel: `${usageStats.limits.storage_gb} GB`,
                          color: '#8b5cf6',
                        },
                      ].map(({ label, value, valueNum, max, maxLabel, color }) => (
                        <div key={label} className="profile-usage-item">
                          <div className="profile-usage-row">
                            <span className="profile-usage-label">{label}</span>
                            <span className="profile-usage-value">
                              {typeof value === 'string' ? value : value} / {maxLabel ?? max}
                            </span>
                          </div>
                          <UsageBar
                            value={valueNum !== undefined ? valueNum : (typeof value === 'number' ? value : 0)}
                            max={max}
                            color={color}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Plan features */}
                    <h4 className="profile-section-title" style={{ marginTop: '1.5rem' }}>
                      <Package size={16} />
                      Plan Özellikleri
                    </h4>
                    <ul className="profile-features-list">
                      {(usageStats.plan_type === 'business' ? [
                        `${usageStats.limits.users} kullanıcı`,
                        `${usageStats.limits.suppliers} tedarikçi`,
                        `Aylık ${usageStats.limits.rfq_per_month} RFQ`,
                        `${usageStats.limits.storage_gb} GB depolama`,
                        'Öncelikli destek',
                        'Gelişmiş raporlama',
                      ] : [
                        `${usageStats.limits.users} kullanıcı`,
                        `${usageStats.limits.suppliers} tedarikçi`,
                        `Aylık ${usageStats.limits.rfq_per_month} RFQ`,
                        `${usageStats.limits.storage_gb} GB depolama`,
                      ]).map(f => (
                        <li key={f} className="profile-feature-item">
                          <CheckCircle size={14} className="profile-feature-check" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            )}

            {isSupplier && usageStats?.customers?.length > 0 && (
              <div className="profile-card">
                <h3 className="profile-section-title">
                  <Building2 size={16} />
                  Bağlı Müşteriler
                </h3>
                <div className="profile-customer-list">
                  {usageStats.customers.map((c) => (
                    <div key={c.customer_id} className="profile-customer-item">
                      <div className="profile-customer-avatar">
                        {(c.customer_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="profile-customer-info">
                        <span className="profile-customer-name">{c.customer_name}</span>
                        <span className="profile-customer-plan">
                          {planIcon(c.plan_type)} {planLabel(c.plan_type)}
                        </span>
                      </div>
                      <div className="profile-customer-stats">
                        <span className="profile-customer-stat">
                          <Clock size={12} />
                          {c.usage?.rfq_this_month ?? 0} RFQ
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isSupplier && (
              <div className="profile-card profile-plan-card">
                <div className="profile-plan-header">
                  <span className="profile-plan-emoji">🔧</span>
                  <div>
                    <h3 className="profile-plan-name">Tedarikçi Hesabı</h3>
                    <p className="profile-plan-since">Kunye.tech platformu üzerinden iş alın</p>
                  </div>
                </div>
                <ul className="profile-features-list" style={{ marginTop: '1rem' }}>
                  {[
                    'Müşterilerden teklif talebi alın',
                    'Proje dosyalarını görüntüleyin',
                    'Teklif gönderin ve kabul edin',
                    'Kontrol listesi ile iş takibi yapın',
                    'Revizyon talepleri yönetin',
                  ].map(f => (
                    <li key={f} className="profile-feature-item">
                      <CheckCircle size={14} className="profile-feature-check" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
