import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import API_URL from '../lib/api'
import { 
  ArrowLeft, FileText, Download, Calendar, Building2, 
  Clock, Send, CheckCircle, Box, FileSpreadsheet, Image, File, Eye, ChevronLeft,
  DollarSign, MessageSquare, Plus, X
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
  
  // Quote form - dosya bazlı teklif sistemi
  const [deliveryDate, setDeliveryDate] = useState('')
  const [quotationItems, setQuotationItems] = useState([]) // { file_id, price, notes } veya { item_type: 'extra', title, price, notes }
  
  // File viewer
  const [activeFile, setActiveFile] = useState(null)
  const [viewMode, setViewMode] = useState('files')
  const [showSubmittedQuotationModal, setShowSubmittedQuotationModal] = useState(false)

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
        
        // Initialize quotation items from project files (STEP files only)
        if (data.project_files && data.project_files.length > 0) {
          const stepFiles = data.project_files.filter(f => f.file_type === 'step' && f.is_active && f.status !== 'pending')
          
          // If already quoted, load existing items
          if (data.my_quotation_status?.quotation_items) {
            setQuotationItems(data.my_quotation_status.quotation_items)
            setDeliveryDate(data.my_quotation_status.delivery_date || '')
          } else {
            // Initialize with empty items for each STEP file
            const initialItems = stepFiles.map(file => ({
              file_id: file.id,
              file_name: file.file_name,
              item_type: 'file',
              price: '',
              quantity: file.quantity || 1,
              notes: ''
            }))
            setQuotationItems(initialItems)
          }
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

  // Check if all step files have prices
  const allStepFilesHavePrices = () => {
    const stepFileItems = quotationItems.filter(item => item.item_type === 'file' || item.file_id)
    if (stepFileItems.length === 0) return false
    return stepFileItems.every(item => item.price && parseFloat(item.price) > 0)
  }

  const handleSubmitQuote = async (e) => {
    e.preventDefault()
    
    // Validate ALL step files have a price
    if (!allStepFilesHavePrices()) {
      alert('Lütfen tüm STEP dosyaları için fiyat giriniz.')
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
          items: quotationItems.filter(item => item.price && parseFloat(item.price) > 0).map(item => ({
            file_id: item.file_id || null,
            item_type: item.item_type || 'file',
            title: item.title || item.file_name || '',
            price: parseFloat(item.price),
            quantity: item.quantity || 1,
            notes: item.notes?.trim() || null
          })),
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

  const handleItemChange = (index, field, value) => {
    setQuotationItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }
  
  const handleActiveFileItemChange = (field, value) => {
    if (!activeFile) return
    
    setQuotationItems(prev => {
      return prev.map(item => {
        if (item.file_id === activeFile.id) {
          return { ...item, [field]: value }
        }
        return item
      })
    })
  }

  const handleAddExtraItem = () => {
    setQuotationItems(prev => [
      ...prev,
      {
        item_type: 'extra',
        title: '',
        price: '',
        quantity: 1,
        notes: ''
      }
    ])
  }

  const handleRemoveExtraItem = (index) => {
    setQuotationItems(prev => prev.filter((_, i) => i !== index))
  }

  const calculateTotal = () => {
    return quotationItems.reduce((total, item) => {
      const price = parseFloat(item.price) || 0
      const quantity = parseInt(item.quantity) || 1
      return total + (price * quantity)
    }, 0)
  }
  
  const getActiveFileItem = () => {
    if (!activeFile) return null
    return quotationItems.find(item => item.file_id === activeFile.id)
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

      {/* Customer Note Alert - if exists */}
      {project.my_quotation_status?.customer_note && (
        <div className="customer-note-alert">
          <div className="alert-icon">
            <MessageSquare size={20} />
          </div>
          <div className="alert-content">
            <div className="alert-header">
              <strong>Müşteri Notu:</strong>
              {project.my_quotation_status?.customer_note_at && (
                <span className="alert-date">
                  {new Date(project.my_quotation_status.customer_note_at).toLocaleDateString('tr-TR')} {new Date(project.my_quotation_status.customer_note_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <p className="alert-text">{project.my_quotation_status.customer_note}</p>
          </div>
        </div>
      )}

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
                  {project.file_checklists[activeFile.id].filter(i => !i.parent_id && i.is_checked).length} / {project.file_checklists[activeFile.id].filter(i => !i.parent_id).length}
                </span>
              </div>
              <p className="checklist-info">
                Teklif kabul edildiğinde bu checklist'i işaretleyebileceksiniz.
              </p>
              <div className="checklist-items-preview">
                {project.file_checklists[activeFile.id].map((parentItem, index) => {
                  // Backend sends hierarchical data with children array
                  const children = parentItem.children || []
                  return (
                    <div key={parentItem.id} className="checklist-group-preview">
                      <div className="checklist-item-preview parent-item">
                        <span className="item-number">{index + 1}.</span>
                        <span className="item-title">
                          {parentItem.title}
                          {children.length > 0 && (
                            <span className="children-count"> ({children.filter(c => c.is_checked).length}/{children.length})</span>
                          )}
                        </span>
                        {parentItem.is_checked && <CheckCircle size={14} className="checked-icon" />}
                      </div>
                      {children.length > 0 && (
                        <div className="checklist-children-preview">
                          {children.map((child, childIndex) => (
                            <div key={child.id} className="checklist-item-preview child-item">
                              <span className="item-number">{index + 1}.{childIndex + 1}</span>
                              <span className="item-title">{child.title}</span>
                              {child.is_checked && <CheckCircle size={14} className="checked-icon" />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Quote Form */}
          <div className="quote-form-section">
            <div className="quote-form-header">
              <h2>
                <DollarSign size={20} />
                {isQuoted ? 'Teklifiniz' : 'Teklif Verin'}
              </h2>
              
              {/* Submitted Quote Info - Compact */}
              {isQuoted && project.my_quotation_status && (
                <div className="submitted-quote-compact">
                  <div className="compact-info">
                    <span className="compact-price">₺{Number(project.my_quotation_status.quoted_price || 0).toLocaleString('tr-TR')}</span>
                    <span className="compact-date">
                      {new Date(project.my_quotation_status.quoted_at).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-compact-view"
                    onClick={() => setShowSubmittedQuotationModal(true)}
                  >
                    <Eye size={14} />
                    Detaylar
                  </button>
                </div>
              )}
            </div>
            
            <form onSubmit={handleSubmitQuote} className="quote-form">
              {/* Viewer Mode - Tek Dosya İçin Fiyat Girişi */}
              {viewMode === 'viewer' && activeFile && activeFile.file_type === 'step' && (
                <div className="single-file-quotation">
                  <h3 className="items-header">
                    <Box size={16} />
                    {activeFile.file_name} için Teklif
                  </h3>
                  
                  {(() => {
                    const fileItem = getActiveFileItem()
                    if (!fileItem) return null
                    
                    return (
                      <div className="quotation-item file-item">
                        <div className="item-inputs-with-calculation">
                          <div className="form-group price-group">
                            <label>Birim Fiyat (₺) *</label>
                            <div className="price-input-wrapper">
                              <span className="currency">₺</span>
                              <input
                                type="number"
                                value={fileItem.price}
                                onChange={(e) => handleActiveFileItemChange('price', e.target.value)}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                              />
                            </div>
                          </div>
                          
                          <div className="calculation-display">
                            <div className="quantity-info">
                              <span className="label">Adet:</span>
                              <span className="value">{fileItem.quantity || 1}</span>
                            </div>
                            <span className="multiply-symbol">×</span>
                            <div className="total-info">
                              <span className="label">Toplam:</span>
                              <span className="value">₺ {((parseFloat(fileItem.price) || 0) * (fileItem.quantity || 1)).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="form-group notes-group">
                          <label>Not (opsiyonel)</label>
                          <textarea
                            value={fileItem.notes || ''}
                            onChange={(e) => handleActiveFileItemChange('notes', e.target.value)}
                            placeholder="Bu dosya için not..."
                            rows={3}
                          />
                        </div>
                        
                        <div className="viewer-mode-info">
                          <MessageSquare size={14} />
                          <span>Değişiklikler otomatik kaydedilir. Teklifi göndermek için "Dosyalara Dön" butonuna tıklayın.</span>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Files Mode - Tüm Dosyalar Özet */}
              {viewMode === 'files' && (
                <div className="quotation-items-section">
                  <h3 className="items-header">Teklif Özeti</h3>
                  
                  {/* Dosya Kalemleri - Sadece Görüntüleme */}
                  {quotationItems.filter(item => item.item_type === 'file').map((item, index) => (
                    <div key={index} className="quotation-item file-item summary-item">
                      <div className="item-summary-row">
                        <div className="file-item-title">
                          <Box size={16} />
                          <span>{item.file_name}</span>
                          {item.revision && <span className="item-revision">Rev. {item.revision}</span>}
                        </div>
                        <div className="item-calculation-display">
                          {item.price ? (
                            <>
                              <span className="unit-price">₺ {parseFloat(item.price).toFixed(2)}</span>
                              <span className="multiply">× {item.quantity || 1}</span>
                              <span className="total-price">= ₺ {((parseFloat(item.price) || 0) * (item.quantity || 1)).toFixed(2)}</span>
                            </>
                          ) : (
                            <span className="no-price">Fiyat girilmedi</span>
                          )}
                        </div>
                      </div>
                      {item.notes && (
                        <div className="item-notes-display">
                          <MessageSquare size={14} />
                          {item.notes}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Ekstra Kalemler - Düzenlenebilir */}
                  {quotationItems.filter(item => item.item_type === 'extra').map((item, index) => {
                    const actualIndex = quotationItems.findIndex(i => i === item)
                    return (
                      <div key={actualIndex} className="quotation-item extra-item">
                        <div className="item-header">
                          <div className="form-group">
                            <label>Kalem Adı *</label>
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => handleItemChange(actualIndex, 'title', e.target.value)}
                              placeholder="Ör: Nakliye, İşçilik, Ekstra İşlem..."
                              required
                            />
                          </div>
                        </div>
                        
                        <div className="item-inputs single-item">
                          <div className="form-group price-group">
                            <label>Fiyat (₺)</label>
                            <div className="price-input-wrapper">
                              <span className="currency">₺</span>
                              <input
                                type="number"
                                value={item.price}
                                onChange={(e) => handleItemChange(actualIndex, 'price', e.target.value)}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div className="form-group notes-group">
                          <label>Not (opsiyonel)</label>
                          <textarea
                            value={item.notes || ''}
                            onChange={(e) => handleItemChange(actualIndex, 'notes', e.target.value)}
                            placeholder="Bu kalem hakkında açıklama..."
                            rows={2}
                          />
                        </div>
                        
                        <button
                          type="button"
                          className="btn-remove-item"
                          onClick={() => handleRemoveExtraItem(actualIndex)}
                        >
                          × Kaldır
                        </button>
                      </div>
                    )
                  })}
                  
                  <button
                    type="button"
                    className="btn btn-secondary btn-add-extra"
                    onClick={handleAddExtraItem}
                  >
                    <Plus size={18} />
                    Ekstra Kalem Ekle (Nakliye, İşçilik vb.)
                  </button>
                </div>
              )}

              {/* Toplam, Termin ve Gönder Butonu - Sadece Files Mode'da */}
              {viewMode === 'files' && (
                <>
                  <div className="quote-summary">
                    <div className="total-price">
                      <span>Toplam Fiyat:</span>
                      <span className="total-amount">₺ {calculateTotal().toFixed(2)}</span>
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

                  <button 
                    type="submit" 
                    className="btn btn-primary btn-submit"
                    disabled={submitting || !allStepFilesHavePrices() || !deliveryDate}
                  >
                    {submitting ? 'Gönderiliyor...' : (
                      <>
                        <Send size={18} />
                        {isQuoted ? 'Teklifi Güncelle' : 'Teklif Gönder'}
                      </>
                    )}
                  </button>
                  {!allStepFilesHavePrices() && (
                    <p className="validation-warning">
                      Tüm STEP dosyalarına fiyat girmeniz gerekmektedir.
                    </p>
                  )}
                </>
              )}

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

      {/* Submitted Quotation Modal */}
      {showSubmittedQuotationModal && isQuoted && project.my_quotation_status && (
        <div className="modal-overlay" onClick={() => setShowSubmittedQuotationModal(false)}>
          <div className="modal-content quotation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <CheckCircle size={24} />
                <h2>Gönderilen Teklif Özeti</h2>
              </div>
              <button className="modal-close" onClick={() => setShowSubmittedQuotationModal(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="modal-body">
              <div className="summary-main-info">
                <div className="summary-total">
                  <span className="summary-label">Toplam Teklif:</span>
                  <span className="summary-total-price">₺{Number(project.my_quotation_status.quoted_price || 0).toLocaleString('tr-TR')}</span>
                </div>
                <div className="summary-meta-row">
                  {project.my_quotation_status.delivery_date && (
                    <div className="summary-delivery">
                      <Calendar size={16} />
                      <span>Termin: {new Date(project.my_quotation_status.delivery_date).toLocaleDateString('tr-TR')}</span>
                    </div>
                  )}
                  <div className="summary-date-sent">
                    <Clock size={16} />
                    <span>
                      Gönderilme: {new Date(project.my_quotation_status.quoted_at).toLocaleDateString('tr-TR')} {new Date(project.my_quotation_status.quoted_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
              
              {project.my_quotation_status.quotation_items && project.my_quotation_status.quotation_items.length > 0 && (
                <div className="summary-items">
                  <h4>Kalemler:</h4>
                  <div className="summary-items-list">
                    {project.my_quotation_status.quotation_items.map((item, idx) => {
                      const itemTotal = (parseFloat(item.price) || 0) * (item.quantity || 1)
                      return (
                        <div key={idx} className="summary-item-row">
                          <div className="summary-item-info">
                            <span className="summary-item-name">
                              {item.item_type === 'file' ? (
                                <>
                                  <Box size={14} />
                                  {item.file_name || item.title}
                                </>
                              ) : (
                                <>
                                  <Plus size={14} />
                                  {item.title}
                                </>
                              )}
                            </span>
                            {item.notes && (
                              <span className="summary-item-note">{item.notes}</span>
                            )}
                          </div>
                          <div className="summary-item-calc">
                            <span className="summary-item-price">₺{Number(item.price || 0).toLocaleString('tr-TR')}</span>
                            <span className="summary-item-multiply">×</span>
                            <span className="summary-item-qty">{item.quantity || 1}</span>
                            <span className="summary-item-equals">=</span>
                            <span className="summary-item-total">₺{itemTotal.toLocaleString('tr-TR')}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              
              {project.my_quotation_status.quoted_note && (
                <div className="summary-general-note">
                  <MessageSquare size={14} />
                  <p>{project.my_quotation_status.quoted_note}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

