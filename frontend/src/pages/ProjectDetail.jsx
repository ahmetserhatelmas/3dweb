import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import API_URL from '../lib/api'
import { 
  ArrowLeft, Check, Upload, FileText, Download,
  Calendar, Building2, User as UserIcon, Clock, CheckCircle, Trash2
} from 'lucide-react'
import StepViewer from '../components/StepViewer'
import './ProjectDetail.css'

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [deletingDoc, setDeletingDoc] = useState(null)

  const fetchProject = async () => {
    try {
      const res = await fetch(`${API_URL}/api/projects/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setProject(data)
      } else {
        navigate(user.role === 'admin' ? '/admin' : (user.role === 'customer' ? '/customer' : '/dashboard'))
      }
    } catch (error) {
      console.error('Fetch project error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isCancelled = false
    
    const loadProject = async () => {
      try {
        const res = await fetch(`${API_URL}/api/projects/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok && !isCancelled) {
          const data = await res.json()
          setProject(data)
        } else if (!isCancelled) {
          navigate(user.role === 'admin' ? '/admin' : (user.role === 'customer' ? '/customer' : '/dashboard'))
        }
      } catch (error) {
        console.error('Fetch project error:', error)
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }
    
    loadProject()
    
    return () => {
      isCancelled = true
    }
  }, [id])

  const handleChecklistChange = async (itemId, checked) => {
    // Optimistic update - UI'ı hemen güncelle
    setProject(prev => ({
      ...prev,
      checklist: prev.checklist.map(item => 
        item.id === itemId ? { ...item, is_checked: checked } : item
      )
    }))

    try {
      const res = await fetch(`${API_URL}/api/projects/${id}/checklist/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_checked: checked })
      })

      // Hata olursa geri al
      if (!res.ok) {
        const errorData = await res.json()
        console.error('Checklist update failed:', errorData)
        setProject(prev => ({
          ...prev,
          checklist: prev.checklist.map(item => 
            item.id === itemId ? { ...item, is_checked: !checked } : item
          )
        }))
      }
    } catch (error) {
      console.error('Update checklist error:', error)
      // Hata olursa geri al
      setProject(prev => ({
        ...prev,
        checklist: prev.checklist.map(item => 
          item.id === itemId ? { ...item, is_checked: !checked } : item
        )
      }))
    }
  }

  const handleComplete = async () => {
    if (!confirm('Tüm kontroller tamamlandı mı? İşi bitirmek istediğinizden emin misiniz?')) {
      return
    }

    setCompleting(true)
    try {
      const res = await fetch(`${API_URL}/api/projects/${id}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (res.ok) {
        setProject(prev => ({ ...prev, status: 'completed' }))
      } else {
        const data = await res.json()
        alert(data.error)
      }
    } catch (error) {
      console.error('Complete project error:', error)
    } finally {
      setCompleting(false)
    }
  }

  const handleDocumentUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploadingDoc(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${API_URL}/api/upload/document/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      })

      if (res.ok) {
        fetchProject()
      } else {
        const data = await res.json()
        alert(data.error)
      }
    } catch (error) {
      console.error('Upload document error:', error)
    } finally {
      setUploadingDoc(false)
      e.target.value = ''
    }
  }

  const handleDeleteDocument = async (docId, docName) => {
    if (!confirm(`"${docName}" dökümanını silmek istediğinize emin misiniz?`)) {
      return
    }

    setDeletingDoc(docId)
    try {
      const res = await fetch(`${API_URL}/api/projects/${id}/documents/${docId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (res.ok) {
        fetchProject()
      } else {
        const data = await res.json()
        alert(data.error)
      }
    } catch (error) {
      console.error('Delete document error:', error)
      alert('Döküman silinirken hata oluştu.')
    } finally {
      setDeletingDoc(null)
    }
  }

  const allChecked = project?.checklist?.every(item => !!item.is_checked)
  const checkedCount = project?.checklist?.filter(item => !!item.is_checked).length || 0
  const totalCount = project?.checklist?.length || 0

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { label: 'Bekliyor', class: 'badge-pending', icon: Clock },
      reviewing: { label: 'İnceleniyor', class: 'badge-reviewing', icon: Clock },
      completed: { label: 'Tamamlandı', class: 'badge-completed', icon: CheckCircle }
    }
    return statusMap[status] || statusMap.pending
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Proje yükleniyor...</p>
      </div>
    )
  }

  if (!project) {
    return null
  }

  const StatusIcon = getStatusBadge(project.status).icon

  return (
    <div className="project-detail-page">
      <header className="detail-header">
        <div className="header-left">
          <Link to={user.role === 'admin' ? '/admin' : '/dashboard'} className="back-link">
            <ArrowLeft size={20} />
            Geri
          </Link>
          <div className="header-info">
            <div className="header-top">
              <h1>{project.name}</h1>
              <span className={`badge ${getStatusBadge(project.status).class}`}>
                <StatusIcon size={14} />
                {getStatusBadge(project.status).label}
              </span>
            </div>
            <div className="header-meta">
              <span className="meta-item">
                <FileText size={16} />
                {project.part_number}
              </span>
              <span className="meta-item">
                <Building2 size={16} />
                {project.supplier_name}
              </span>
              {project.deadline && (
                <span className="meta-item">
                  <Calendar size={16} />
                  {new Date(project.deadline).toLocaleDateString('tr-TR')}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {user.role === 'user' && project.status !== 'completed' && (
          <button 
            className="btn btn-primary"
            onClick={handleComplete}
            disabled={!allChecked || completing}
          >
            {completing ? 'Tamamlanıyor...' : (
              <>
                <CheckCircle size={18} />
                İşi Tamamla
              </>
            )}
          </button>
        )}
      </header>

      <div className="detail-content">
        <div className="viewer-panel">
          <div className="panel-header">
            <h2>3D Model</h2>
            {project.step_file_name && (
              <span className="file-name">{project.step_file_name}</span>
            )}
          </div>
          <div className="viewer-container">
            {project.step_file_path ? (
              <StepViewer fileUrl={project.step_file_path} />
            ) : (
              <div className="no-model">
                <FileText size={48} />
                <p>3D model yüklenmemiş</p>
              </div>
            )}
          </div>
        </div>

        <div className="checklist-panel">
          <div className="panel-header">
            <h2>Kontrol Listesi</h2>
            <span className="progress-text">{checkedCount} / {totalCount}</span>
          </div>

          <div className="progress-bar">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%` }}
            />
          </div>

          <div className="checklist-items">
            {project.checklist.map((item, index) => (
              <label key={item.id} className={`checkbox-wrapper ${item.is_checked ? 'is-checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={!!item.is_checked}
                  onChange={(e) => handleChecklistChange(item.id, e.target.checked)}
                  disabled={project.status === 'completed' || user.role === 'admin'}
                />
                <span className="checkbox-custom">
                  <Check size={14} />
                </span>
                <span className="checkbox-label">
                  <span className="item-number">{index + 1}.</span>
                  {item.title}
                </span>
                {item.is_checked && user.role === 'admin' && (
                  <span className="checked-indicator">✓ Tamamlandı</span>
                )}
              </label>
            ))}
          </div>

          {user.role === 'user' && project.status !== 'completed' && (
            <div className="upload-section">
              <h3>Döküman Yükle</h3>
              <p>Sertifika, rapor veya diğer dökümanları yükleyin</p>
              <label className="upload-btn">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={handleDocumentUpload}
                  disabled={uploadingDoc}
                />
                <Upload size={18} />
                {uploadingDoc ? 'Yükleniyor...' : 'Dosya Seç'}
              </label>
            </div>
          )}

          {project.documents && project.documents.length > 0 && (
            <div className="documents-section">
              <h3>Yüklenen Dökümanlar</h3>
              <div className="documents-list">
                {project.documents.map(doc => (
                  <div key={doc.id} className="document-item-wrapper">
                    <a 
                      href={doc.file_path} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="document-item"
                    >
                      <FileText size={18} />
                      <span>{doc.file_name}</span>
                      <Download size={16} />
                    </a>
                    {user.role === 'user' && project.status !== 'completed' && (
                      <button
                        className="delete-doc-btn"
                        onClick={() => handleDeleteDocument(doc.id, doc.file_name)}
                        disabled={deletingDoc === doc.id}
                        title="Dökümanı Sil"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}






