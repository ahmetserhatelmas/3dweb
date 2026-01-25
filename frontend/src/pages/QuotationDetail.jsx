import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import API_URL from '../lib/api'
import { 
  ArrowLeft, FileText, Download, Calendar, Building2, 
  Clock, Send, CheckCircle, Box, FileSpreadsheet, Image, File, Eye, ChevronLeft,
  DollarSign, MessageSquare
} from 'lucide-react'
import StepViewer from '../components/StepViewer'
import './QuotationDetail.css'

// File type icons
const getFileIcon = (type) => {
  switch (type) {
    case 'step': return <Box size={20} className="file-icon step" />
    case 'pdf': return <FileText size={20} className="file-icon pdf" />
    case 'excel': return <FileSpreadsheet size={20} className="file-icon excel" />
    case 'image': return <Image size={20} className="file-icon image" />
    default: return <File size={20} className="file-icon" />
  }
}

export default function QuotationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { token } = useAuth()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  // Quote form
  const [price, setPrice] = useState('')
  const [note, setNote] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  
  // File viewer
  const [activeFile, setActiveFile] = useState(null)
  const [viewMode, setViewMode] = useState('files')

  useEffect(() => {
    fetchProject()
  }, [id])

  const fetchProject = async () => {
    try {
      const res = await fetch(`${API_URL}/api/projects/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setProject(data)
        // Pre-fill if already quoted
        if (data.my_quotation_status?.quoted_price) {
          setPrice(data.my_quotation_status.quoted_price.toString())
          setNote(data.my_quotation_status.quoted_note || '')
          setDeliveryDate(data.my_quotation_status.delivery_date || '')
        }
      } else {
        navigate('/dashboard')
      }
    } catch (error) {
      console.error('Fetch project error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitQuote = async (e) => {
    e.preventDefault()
    
    if (!price || parseFloat(price) <= 0) {
      alert('Lütfen geçerli bir fiyat giriniz.')
      return
    }

    if (!deliveryDate) {
      alert('Lütfen termin tarihi giriniz.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`${API_URL}/api/projects/quotations/${id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          price: parseFloat(price),
          note: note.trim() || null,
          delivery_date: deliveryDate
        })
      })

      if (res.ok) {
        alert('Teklif başarıyla gönderildi!')
        fetchProject() // Refresh to show updated status
      } else {
        const data = await res.json()
        alert(data.error || 'Teklif gönderilemedi.')
      }
    } catch (error) {
      console.error('Submit quote error:', error)
      alert('Bir hata oluştu.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileClick = (file) => {
    setActiveFile(file)
    setViewMode('viewer')
  }

  const handleBackToFiles = () => {
    setActiveFile(null)
    setViewMode('files')
  }

  const renderFilePreview = (file) => {
    if (!file) return null

    switch (file.file_type) {
      case 'step':
        return <StepViewer fileUrl={file.file_url} />
      case 'pdf':
        return (
          <iframe 
            src={file.file_url} 
            className="pdf-preview"
            title={file.file_name}
          />
        )
      case 'excel':
        return (
          <div className="excel-preview">
            <FileSpreadsheet size={64} />
            <p>{file.file_name}</p>
            <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              <Download size={18} />
              Excel'i İndir
            </a>
          </div>
        )
      case 'image':
        return (
          <img 
            src={file.file_url} 
            alt={file.file_name}
            className="image-preview"
          />
        )
      default:
        return (
          <div className="file-preview-placeholder">
            <File size={64} />
            <p>{file.file_name}</p>
            <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              <Download size={18} />
              Dosyayı İndir
            </a>
          </div>
        )
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Proje yükleniyor...</p>
      </div>
    )
  }

  if (!project) return null

  const quotationStatus = project.my_quotation_status?.status || 'pending'
  const isQuoted = quotationStatus === 'quoted'
  const hasProjectFiles = project.project_files && project.project_files.length > 0

  return (
    <div className="quotation-detail-page">
      <header className="detail-header">
        <div className="header-left">
          <Link to="/quotations" className="back-link">
            <ArrowLeft size={20} />
            Tekliflere Dön
          </Link>
          <div className="header-info">
            <div className="header-top">
              <h1>{project.name}</h1>
              <span className={`badge ${isQuoted ? 'badge-quoted' : 'badge-pending'}`}>
                {isQuoted ? (
                  <>
                    <Send size={14} />
                    Teklif Verildi
                  </>
                ) : (
                  <>
                    <Clock size={14} />
                    Teklif Bekliyor
                  </>
                )}
              </span>
            </div>
            <div className="header-meta">
              {project.part_number && (
                <span className="meta-item">
                  <FileText size={16} />
                  {project.part_number}
                </span>
              )}
              <span className="meta-item">
                <Building2 size={16} />
                {project.creator_company || project.creator_username || 'Müşteri'}
              </span>
              {project.deadline && (
                <span className="meta-item deadline">
                  <Calendar size={16} />
                  Termin: {new Date(project.deadline).toLocaleDateString('tr-TR')}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="detail-content">
        {/* Left Panel: Files Viewer */}
        <div className="viewer-panel">
          {viewMode === 'files' && hasProjectFiles ? (
            <>
              <div className="panel-header">
                <h2>Proje Dosyaları</h2>
                <span className="file-count">{project.project_files.length} dosya</span>
              </div>
              <div className="files-grid">
                {project.project_files.map((file, index) => (
                  <div 
                    key={file.id || index} 
                    className="project-file-card"
                    onClick={() => handleFileClick(file)}
                  >
                    <div className="file-card-icon">
                      {getFileIcon(file.file_type)}
                    </div>
                    <div className="file-card-info">
                      <span className="file-card-name">{file.file_name}</span>
                      {file.description && (
                        <span className="file-card-desc">{file.description}</span>
                      )}
                      <div className="file-card-meta">
                        {file.file_type === 'step' && file.quantity > 1 && (
                          <span className="file-card-qty">{file.quantity} adet</span>
                        )}
                        {file.revision && (
                          <span className="file-card-revision">Rev. {file.revision}</span>
                        )}
                      </div>
                    </div>
                    <div className="file-card-badge">
                      {file.file_type.toUpperCase()}
                    </div>
                    <button className="file-card-view">
                      <Eye size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : viewMode === 'viewer' && activeFile ? (
            <>
              <div className="panel-header">
                <button className="back-to-files" onClick={handleBackToFiles}>
                  <ChevronLeft size={20} />
                  Dosyalara Dön
                </button>
                <span className="file-name">{activeFile.file_name}</span>
              </div>
              <div className="viewer-container">
                {renderFilePreview(activeFile)}
              </div>
              {activeFile.notes && (
                <div className="file-notes">
                  <strong>Not:</strong> {activeFile.notes}
                </div>
              )}
            </>
          ) : (
            // Legacy single file
            <>
              <div className="panel-header">
                <h2>3D Model</h2>
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
            </>
          )}
        </div>

        {/* Right Panel: Quote Form & Checklist Preview */}
        <div className="quote-panel">
          {/* STEP Dosyası Checklist - görüntülenen STEP dosyası için */}
          {viewMode === 'viewer' && activeFile?.file_type === 'step' && project.file_checklists?.[activeFile.id] && (
            <div className="file-checklist-section">
              <div className="panel-header">
                <h2>
                  <Box size={18} />
                  Dosya Kontrolü (Önizleme)
                </h2>
                <span className="progress-text">
                  {project.file_checklists[activeFile.id].filter(i => i.is_checked).length} / {project.file_checklists[activeFile.id].length}
                </span>
              </div>
              <p className="checklist-info">
                Teklif kabul edildiğinde bu checklist'i işaretleyebileceksiniz.
              </p>
              <div className="checklist-items-preview">
                {project.file_checklists[activeFile.id].map((item, index) => (
                  <div key={item.id} className="checklist-item-preview">
                    <span className="item-number">{index + 1}.</span>
                    <span className="item-title">{item.title}</span>
                    {item.is_checked && <CheckCircle size={14} className="checked-icon" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quote Form */}
          <div className="quote-form-section">
            <h2>
              <DollarSign size={20} />
              {isQuoted ? 'Teklifiniz' : 'Teklif Verin'}
            </h2>
            
            <form onSubmit={handleSubmitQuote} className="quote-form">
              <div className="form-group">
                <label htmlFor="price">Teklif Fiyatı (₺) *</label>
                <div className="price-input-wrapper">
                  <span className="currency">₺</span>
                  <input
                    type="number"
                    id="price"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="deliveryDate">
                  <Calendar size={16} />
                  Termin Tarihi *
                </label>
                <div className="date-input-wrapper">
                  <input
                    type="date"
                    id="deliveryDate"
                    className="date-input"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="note">
                  <MessageSquare size={16} />
                  Not (opsiyonel)
                </label>
                <textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Teklif hakkında açıklama, teslim süresi, özel koşullar..."
                  rows={4}
                />
              </div>

              <button 
                type="submit" 
                className="btn btn-primary btn-submit"
                disabled={submitting}
              >
                {submitting ? 'Gönderiliyor...' : (
                  <>
                    <Send size={18} />
                    {isQuoted ? 'Teklifi Güncelle' : 'Teklif Gönder'}
                  </>
                )}
              </button>

              {isQuoted && project.my_quotation_status?.quoted_at && (
                <p className="quoted-info">
                  Son güncelleme: {new Date(project.my_quotation_status.quoted_at).toLocaleDateString('tr-TR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              )}
            </form>
          </div>

          {/* Genel Proje Checklist Preview (Read-only) - Sadece dosya görünümünde değilse göster */}
          {viewMode !== 'viewer' && (
            <div className="checklist-preview-section">
              <h2>
                <CheckCircle size={20} />
                Kontrol Listesi (Önizleme)
              </h2>
              <p className="checklist-info">
                Teklif kabul edildiğinde bu checklist'i işaretleyebileceksiniz.
              </p>
              <div className="checklist-items-preview">
                {project.checklist.map((item, index) => (
                  <div key={item.id} className="checklist-item-preview">
                    <span className="item-number">{index + 1}.</span>
                    <span className="item-title">{item.title}</span>
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

