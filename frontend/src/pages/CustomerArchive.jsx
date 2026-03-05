import { useState, useEffect, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import API_URL from '../lib/api'
import {
  ArrowLeft, FileBox, Users, Calendar, ChevronRight, LogOut,
  Box, Plus, DollarSign, UserPlus, Settings, Sun, Moon
} from 'lucide-react'
import { formatDeadlineInfo } from '../utils/dateUtils'
import './Dashboard.css'
import './ProjectDetail.css'

export default function CustomerArchive() {
  const { user, token, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef(null)
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [archiveProject, setArchiveProject] = useState(null)
  const [quotations, setQuotations] = useState([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    fetchProjects()
  }, [])

  useEffect(() => {
    if (projectId) {
      fetchArchiveDetail(projectId)
    } else {
      setArchiveProject(null)
      setQuotations([])
    }
  }, [projectId])

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_URL}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        const accepted = (data || []).filter((p) =>
          p.project_suppliers?.some((ps) => ps.status === 'accepted')
        )
        setProjects(accepted)
      }
    } catch (error) {
      console.error('Fetch projects error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchArchiveDetail = async (id) => {
    setLoadingDetail(true)
    try {
      const [projRes, quotRes] = await Promise.all([
        fetch(`${API_URL}/api/projects/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/projects/${id}/quotations`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ])
      if (projRes.ok && quotRes.ok) {
        const [proj, quot] = await Promise.all([projRes.json(), quotRes.json()])
        setArchiveProject(proj)
        setQuotations(quot || [])
      } else {
        navigate('/customer/archive')
      }
    } catch (error) {
      console.error('Fetch archive detail error:', error)
      navigate('/customer/archive')
    } finally {
      setLoadingDetail(false)
    }
  }

  const allSuppliers = quotations
  const quotedSuppliers = quotations.filter((q) => q.status === 'quoted')

  const allFileItems = []
  const allExtraItems = new Set()
  quotedSuppliers.forEach((q) => {
    const items = q.quotation?.[0]?.quotation_items || []
    items.forEach((item) => {
      if (item.item_type === 'file' && item.file_id) {
        if (!allFileItems.find((f) => f.file_id === item.file_id)) {
          allFileItems.push({
            file_id: item.file_id,
            file_name: item.file?.file_name || item.title,
            revision: item.file?.revision,
            quantity: item.quantity
          })
        }
      } else if (item.item_type === 'extra') {
        allExtraItems.add(item.title)
      }
    })
  })
  const cadFileTypes = ['step', 'dxf', 'iges', 'parasolid']
  archiveProject?.project_files
    ?.filter((f) => cadFileTypes.includes(f.file_type) && f.is_active)
    ?.forEach((file) => {
      if (!allFileItems.find((f) => f.file_id === file.id)) {
        allFileItems.push({
          file_id: file.id,
          file_name: file.file_name,
          revision: file.revision,
          quantity: file.quantity
        })
      }
    })

  const showDetail = Boolean(projectId && archiveProject)

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="/LOGO.png" alt="Kunye.tech" className="sidebar-logo-img" />
          <span>Kunye.tech</span>
        </div>
        <nav className="sidebar-nav">
          <Link to="/customer" className="nav-item">
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
          <Link to="/customer/archive" className="nav-item active">
            <DollarSign size={20} />
            <span>Arşiv Teklifler</span>
          </Link>
        </nav>
        <div className="sidebar-footer">
          <div className="user-info-wrap" ref={settingsRef}>
            <div className="user-info" onClick={() => setSettingsOpen(o => !o)} style={{ cursor: 'pointer', flex: 1 }}>
              <div className="user-avatar">{user?.username?.charAt(0).toUpperCase()}</div>
              <div className="user-details">
                <span className="user-name">{user?.username}</span>
                <span className="user-role-label">Müşteri</span>
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
        {!showDetail ? (
          <>
            <div className="page-header">
              <div>
                <h1 className="page-title">Arşiv Teklifler</h1>
                <p className="page-subtitle">Kabul edilen projelerin teklif karşılaştırma tabloları</p>
              </div>
            </div>
            {loading ? (
              <div className="loading-screen">
                <div className="loading-spinner"></div>
              </div>
            ) : projects.length === 0 ? (
              <div className="empty-state">
                <FileBox className="empty-state-icon" />
                <h3 className="empty-state-title">Henüz arşivlenmiş proje yok</h3>
                <p>Teklif kabul edilen projeler burada listelenir.</p>
              </div>
            ) : (
              <div className="stagger-children projects-grid">
                {projects.map((project) => {
                  const accepted = project.project_suppliers?.find((ps) => ps.status === 'accepted')
                  return (
                    <Link
                      to={`/customer/archive/${project.id}`}
                      key={project.id}
                      className="project-card"
                    >
                      <div className="project-card-header">
                        <span className="badge badge-completed">Kabul edildi</span>
                        <ChevronRight size={20} className="card-arrow" />
                      </div>
                      <h3 className="project-name">
                        {project.name}
                        {project.current_revision && (
                          <span className="revision-badge">Rev. {project.current_revision}</span>
                        )}
                      </h3>
                      <div className="project-meta">
                        <div className="meta-item">
                          <Users size={16} />
                          <span>
                            {accepted?.supplier?.company_name ||
                              accepted?.supplier?.username ||
                              '—'}
                          </span>
                        </div>
                        {project.deadline && (
                          <div
                            className={`meta-item deadline ${formatDeadlineInfo(project.deadline)?.urgency || ''}`}
                          >
                            <Calendar size={16} />
                            <span>
                              Termin: {new Date(project.deadline).toLocaleDateString('tr-TR')}
                              <strong className="days-remaining">
                                {' '}
                                ({formatDeadlineInfo(project.deadline)?.daysStr})
                              </strong>
                            </span>
                          </div>
                        )}
                        {accepted?.quoted_price != null && (
                          <div className="meta-item price">
                            <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#10b981' }}>
                              Fiyat: {Number(accepted.quoted_price).toLocaleString('tr-TR')}₺
                            </span>
                          </div>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <div className="archive-detail-view">
            <div className="detail-header">
              <div className="header-left">
                <button
                  type="button"
                  className="back-link"
                  onClick={() => navigate('/customer/archive')}
                >
                  <ArrowLeft size={20} />
                  Arşive dön
                </button>
                <div className="header-info">
                  <h1 className="header-top">{archiveProject.name}</h1>
                  <div className="header-meta">
                    <span className="meta-item">
                      Termin:{' '}
                      {archiveProject.deadline
                        ? new Date(archiveProject.deadline).toLocaleDateString('tr-TR')
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="archive-table-section">
              <h2 className="archive-table-title">
                <DollarSign size={20} />
                Teklif Karşılaştırma Tablosu (Arşiv)
              </h2>
              {loadingDetail ? (
                <div className="loading-screen">
                  <div className="loading-spinner"></div>
                </div>
              ) : (
                <div className="comparison-table-wrapper comparison-table-transposed comparison-table-archive">
                  <table className="comparison-table">
                    <colgroup>
                      <col style={{ width: '220px' }} />
                      {allSuppliers.map((_, i) => (
                        <col key={i} style={{ width: '180px' }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="sticky-col label-col">Tedarikçiler</th>
                        {allSuppliers.map((quotation) => (
                          <th key={quotation.id} className="supplier-col">
                            <div className="supplier-info-cell">
                              <div className="supplier-avatar-badge">
                                {(quotation.supplier?.company_name || quotation.supplier?.username || '?').charAt(0).toUpperCase()}
                              </div>
                              <span className="supplier-name">
                                {quotation.supplier?.company_name || quotation.supplier?.username}
                              </span>
                              {quotation.supplier?.company_name && quotation.supplier?.username && (
                                <span className="supplier-username">@{quotation.supplier.username}</span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="row-termin">
                        <td className="sticky-col label-cell row-label-termin">Termin Tarihi</td>
                        {allSuppliers.map((quotation) => {
                          const delivery =
                            quotation.quotation?.[0]?.delivery_date || quotation.delivery_date
                          return (
                            <td key={quotation.id} className="delivery-cell">
                              {delivery
                                ? new Date(delivery).toLocaleDateString('tr-TR')
                                : '—'}
                            </td>
                          )
                        })}
                      </tr>
                      {allFileItems.map((file, idx) => (
                        <tr key={idx}>
                          <td className="sticky-col label-cell part-label">
                            <div className="part-header">
                              <Box size={13} />
                              <span className="part-name" title={file.file_name}>
                                {file.file_name}
                              </span>
                              {file.revision && (
                                <span className="part-rev">Rev.{file.revision}</span>
                              )}
                              <span className="part-qty">× {file.quantity || 1}</span>
                            </div>
                          </td>
                          {allSuppliers.map((quotation) => {
                            const items = quotation.quotation?.[0]?.quotation_items || []
                            const itemsMap = {}
                            items.forEach((item) => {
                              if (item.item_type === 'file' && item.file_id)
                                itemsMap[item.file_id] = item
                            })
                            const item = itemsMap[file.file_id]
                            return (
                              <td key={quotation.id} className="price-cell">
                                {item ? (
                                  <div className="price-info">
                                    <span className="unit-price">
                                      ₺{Number(item.price).toLocaleString('tr-TR')}
                                    </span>
                                    <span className="total-item-price">
                                      = ₺{(Number(item.price) * Number(item.quantity)).toLocaleString('tr-TR')}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="no-price">—</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                      <tr>
                        <td className="sticky-col label-cell extra-label">
                          <div className="part-header extra">
                            <Plus size={13} />
                            <span className="part-name">Ek İş</span>
                          </div>
                        </td>
                        {allSuppliers.map((quotation) => {
                          const items = quotation.quotation?.[0]?.quotation_items || []
                          const extraTotal = items
                            .filter((item) => item.item_type === 'extra')
                            .reduce(
                              (sum, item) =>
                                sum + Number(item.price) * Number(item.quantity || 1),
                              0
                            )
                          return (
                            <td key={quotation.id} className="price-cell extra-cell">
                              {extraTotal > 0 ? (
                                <span className="extra-price">
                                  ₺{extraTotal.toLocaleString('tr-TR')}
                                </span>
                              ) : (
                                <span className="no-price">—</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                      <tr className="row-total">
                        <td className="sticky-col label-cell row-label-total">Toplam</td>
                        {allSuppliers.map((quotation) => {
                          const totalPrice = Number(
                            quotation.quotation?.[0]?.total_price || quotation.quoted_price || 0
                          )
                          return (
                            <td key={quotation.id} className="total-cell">
                              {totalPrice > 0 ? (
                                <span className="total-price">
                                  ₺{totalPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="no-price">—</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
