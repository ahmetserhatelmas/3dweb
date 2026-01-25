import { useState, useEffect } from 'react'
import { 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  Upload,
  Package
} from 'lucide-react'
import { api } from '../lib/api'
import './RevisionManager.css'

export const RevisionManager = ({ projectId, file, userRole, project, onRevisionAccepted, onRevisionCreated }) => {
  const [revisionRequests, setRevisionRequests] = useState([])
  const [allRevisionRequests, setAllRevisionRequests] = useState([]) // All requests for checking pending status
  const [revisionHistory, setRevisionHistory] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showCompletedRequests, setShowCompletedRequests] = useState(false) // New: for collapsible completed requests
  const [isExpanded, setIsExpanded] = useState(false) // New: for collapsible entire manager
  const [loading, setLoading] = useState(false)
  
  // Supplier quotation states
  const [quotingRequestId, setQuotingRequestId] = useState(null)
  const [quotedPrice, setQuotedPrice] = useState('')
  const [quotedDeadline, setQuotedDeadline] = useState('')
  const [quotedNote, setQuotedNote] = useState('')
  
  // Form states
  const [revisionType, setRevisionType] = useState('geometry')
  const [description, setDescription] = useState('')
  const [newQuantity, setNewQuantity] = useState(file?.quantity || 1)
  const [affectScope, setAffectScope] = useState('file_only')
  const [newFile, setNewFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (projectId) {
      loadRevisionRequests()
    }
  }, [projectId, file?.id, userRole])

  useEffect(() => {
    if (file?.id && showHistory) {
      loadRevisionHistory()
    }
  }, [file?.id, showHistory])

  const loadRevisionRequests = async () => {
    try {
      const data = await api.getRevisionRequests(projectId)
      console.log('All revision requests:', data)
      console.log('Current file:', file)
      
      // Store all requests for checking pending status
      setAllRevisionRequests(data)
      
      // Filter by current file for all users (suppliers should only see requests for the selected file)
      let filteredRequests = []
      if (file?.id) {
        // Filter by current file AND its parent (for pending files)
        // This ensures we show requests for:
        // 1. The current file (r.file_id === file.id)
        // 2. The parent file if current file is a preview (r.file_id === file.parent_file_id)
        // 3. Requests where current file is the pending preview (r.pending_file_id === file.id)
        filteredRequests = data.filter(r => 
          r.file_id === file.id || 
          r.file_id === file.parent_file_id ||
          r.pending_file_id === file.id
        )
      } else {
        // If no file is selected, show all requests (shouldn't happen in normal flow)
        filteredRequests = data
      }
      
      console.log('Filtered revision requests:', filteredRequests)
      setRevisionRequests(filteredRequests)
    } catch (error) {
      console.error('Load revision requests error:', error)
    }
  }

  const loadRevisionHistory = async () => {
    try {
      const data = await api.getRevisionHistory(file.id)
      setRevisionHistory(data.history || [])
    } catch (error) {
      console.error('Load revision history error:', error)
    }
  }

  // Check if there's a pending revision request for this file
  const hasPendingRevisionRequest = () => {
    if (!file?.id) return false
    
    return allRevisionRequests.some(r => 
      (r.file_id === file.id || r.pending_file_id === file.id) &&
      (r.status === 'pending' || r.status === 'awaiting_customer_approval')
    )
  }

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return

    // Validate file type for geometry revision
    if (revisionType === 'geometry' || revisionType === 'both') {
      const ext = selectedFile.name.split('.').pop().toLowerCase()
      if (!['step', 'stp', 'pdf', 'jpg', 'jpeg', 'png'].includes(ext)) {
        alert('Geçerli bir dosya formatı seçin (STEP, PDF, veya resim)')
        return
      }
    }

    setNewFile(selectedFile)
  }

  const handleCreateRevision = async () => {
    try {
      setUploading(true)

      let uploadedFileUrl = null
      let uploadedFilePath = null

      // Upload file if geometry revision or both
      if ((revisionType === 'geometry' || revisionType === 'both') && newFile) {
        console.log('Uploading file:', newFile.name)
        const uploadResult = await api.uploadFile(newFile)
        console.log('Upload result:', uploadResult)
        uploadedFileUrl = uploadResult.url
        uploadedFilePath = uploadResult.path
      }

      // Create revision request
      const payload = {
        revision_type: revisionType,
        description,
        ...((revisionType === 'geometry' || revisionType === 'both') && {
          new_file_url: uploadedFileUrl,
          new_file_path: uploadedFilePath
        }),
        ...((revisionType === 'quantity' || revisionType === 'both') && {
          new_quantity: parseInt(newQuantity),
          affect_scope: affectScope
        })
      }

      console.log('Creating revision request with payload:', payload)
      const result = await api.createRevisionRequest(projectId, file.id, payload)
      console.log('Revision request created:', result)
      
      alert('Revizyon talebi oluşturuldu. Tedarikçi onayını bekliyor.')
      setShowCreateModal(false)
      resetForm()
      loadRevisionRequests()
      
      // Refresh project files to show preview files
      if (onRevisionCreated) {
        onRevisionCreated()
      }
    } catch (error) {
      console.error('Create revision error:', error)
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        data: error.response?.data
      })
      alert(error.message || error.response?.data?.error || 'Revizyon talebi oluşturulamadı.')
    } finally {
      setUploading(false)
    }
  }

  const handleAcceptRevision = async (requestId) => {
    if (!confirm('Bu revizyonu kabul etmek istediğinize emin misiniz? Proje fiyat ve termin güncellenecek.')) return

    try {
      setLoading(true)
      await api.acceptRevisionRequest(requestId)
      alert('Revizyon kabul edildi ve uygulandı.')
      loadRevisionRequests()
      if (onRevisionAccepted) onRevisionAccepted()
    } catch (error) {
      console.error('Accept revision error:', error)
      alert(error.message || 'Revizyon kabul edilemedi.')
    } finally {
      setLoading(false)
    }
  }

  const handleQuoteRevision = async (requestId) => {
    if (!quotedPrice || !quotedDeadline) {
      alert('Lütfen fiyat ve termin bilgisi girin.')
      return
    }

    try {
      setLoading(true)
      await api.quoteRevisionRequest(requestId, {
        quoted_price: parseFloat(quotedPrice),
        quoted_deadline: quotedDeadline,
        quoted_note: quotedNote
      })
      alert('Revizyon teklifi gönderildi. Müşteri onayını bekliyor.')
      setQuotingRequestId(null)
      setQuotedPrice('')
      setQuotedDeadline('')
      setQuotedNote('')
      loadRevisionRequests()
    } catch (error) {
      console.error('Quote revision error:', error)
      alert(error.message || 'Revizyon teklifi gönderilemedi.')
    } finally {
      setLoading(false)
    }
  }

  const handleRejectRevision = async (requestId) => {
    const reason = prompt('Red nedeni:')
    if (!reason) return

    try {
      setLoading(true)
      await api.rejectRevisionRequest(requestId, reason)
      alert('Revizyon talebi reddedildi.')
      loadRevisionRequests()
    } catch (error) {
      console.error('Reject revision error:', error)
      alert(error.message || 'Revizyon reddedilemedi.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelRevision = async (requestId) => {
    if (!confirm('Bu revizyon talebini iptal etmek istediğinize emin misiniz?')) return

    try {
      setLoading(true)
      await api.cancelRevisionRequest(requestId)
      alert('Revizyon talebi iptal edildi.')
      loadRevisionRequests()
      
      // Refresh project files to remove preview files
      if (onRevisionCreated) {
        onRevisionCreated()
      }
    } catch (error) {
      console.error('Cancel revision error:', error)
      alert(error.message || 'Revizyon iptal edilemedi.')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setDescription('')
    setNewQuantity(file?.quantity || 1)
    setAffectScope('file_only')
    setNewFile(null)
    setRevisionType('geometry')
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock size={16} className="status-icon pending" />
      case 'accepted': return <CheckCircle size={16} className="status-icon accepted" />
      case 'rejected': return <XCircle size={16} className="status-icon rejected" />
      default: return null
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'Bekliyor'
      case 'awaiting_customer_approval': return 'Müşteri Onayı Bekleniyor'
      case 'accepted': return 'Kabul Edildi'
      case 'rejected': return 'Reddedildi'
      case 'cancelled': return 'İptal Edildi'
      default: return status
    }
  }

  return (
    <div className="revision-manager-card">
      <div 
        className="revision-card-header clickable"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="revision-title-section">
          <FileText size={18} />
          <div>
            <h3 className="revision-title">Revizyon Yönetimi</h3>
            <p className="revision-subtitle">{file?.file_name} <span className="revision-badge">Rev. {file?.revision || 'A'}</span></p>
          </div>
        </div>
        
        <div className="revision-toggle-icon">
          {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
        </div>
      </div>

      {isExpanded && (
        <div className="revision-content-wrapper">
          <div className="revision-actions-bar">
            {userRole === 'customer' && (
              <>
                {/* Check if file is inactive or pending */}
                {(file?.is_active === false || file?.status === 'inactive' || file?.status === 'pending') ? (
                  <div className="revision-warning">
                    <AlertCircle size={16} />
                    <span>
                      {file?.status === 'pending' 
                        ? 'Önizleme dosyasında revizyon talebi oluşturamazsınız.' 
                        : 'Pasif dosyalarda revizyon talebi oluşturamazsınız.'}
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Check if file is a .step file */}
                    {file?.file_type !== 'step' ? (
                      <div className="revision-warning">
                        <AlertCircle size={16} />
                        <span>Revizyon talebi sadece .step dosyaları için oluşturulabilir.</span>
                      </div>
                    ) : hasPendingRevisionRequest() ? (
                      <div className="revision-warning">
                        <AlertCircle size={16} />
                        <span>Bu dosya için bekleyen bir revizyon talebi veya gelen teklif var. Yeni revizyon talebi oluşturmak için önce mevcut talebi tamamlayın.</span>
                      </div>
                    ) : (
                      /* Check if project has accepted supplier */
                      project?.is_quotation === false || 
                      (project?.suppliers && project.suppliers.some(s => s.status === 'accepted')) ? (
                        <button 
                          className="btn-revision-create"
                          onClick={() => setShowCreateModal(true)}
                        >
                          Revizyon Talebi Oluştur
                        </button>
                      ) : (
                        <div className="revision-warning">
                          <AlertCircle size={16} />
                          <span>Revizyon talebi oluşturmak için önce bir tedarikçi seçmelisiniz.</span>
                        </div>
                      )
                    )}
                  </>
                )}
              </>
            )}
            
            <button 
              className="btn-revision-toggle"
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? 'Geçmişi Gizle' : 'Revizyon Geçmişi'}
            </button>
          </div>

      {/* Pending Requests */}
      {revisionRequests.filter(r => r.status === 'pending').length > 0 && (
        <div className="pending-requests">
          <h4>Bekleyen Revizyon Talepleri (Tedarikçi Teklifi Bekleniyor)</h4>
          {revisionRequests.filter(r => r.status === 'pending').map(request => (
            <div key={request.id} className="revision-request pending">
              <div className="request-header">
                {getStatusIcon(request.status)}
                <span className="request-type">
                  {request.revision_type === 'geometry' ? '🔧 Geometri Revizyonu' : 
                   request.revision_type === 'quantity' ? '📦 Adet Revizyonu' : 
                   '🔧📦 Geometri + Adet Revizyonu'}
                </span>
                <span className="request-revision">{request.from_revision} → {request.to_revision}</span>
                <span className="request-date">
                  {new Date(request.requested_at).toLocaleDateString('tr-TR')}
                </span>
              </div>
              
                <div className="request-body">
                  <p className="request-description">{request.description}</p>
                  
                  {/* Show quantity change for both/quantity revisions */}
                  {(request.revision_type === 'quantity' || request.revision_type === 'both') && (
                    <div className="quantity-change">
                      <Package size={14} />
                      <span>Adet: {request.old_quantity} → {request.new_quantity}</span>
                      {request.affect_scope === 'project_wide' && (
                        <span className="scope-badge">Tüm Projeyi Etkiler</span>
                      )}
                    </div>
                  )}
                
                <div className="request-meta">
                  <span>Talep eden: {request.requester?.company_name || request.requester?.username}</span>
                </div>
              </div>

              {userRole === 'user' && request.status === 'pending' && (
                <>
                  {quotingRequestId === request.id ? (
                    <div className="quotation-form">
                      <h5>Revizyon Teklifi</h5>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Fiyat (₺) *</label>
                          <input
                            type="number"
                            value={quotedPrice}
                            onChange={(e) => setQuotedPrice(e.target.value)}
                            placeholder="Örn: 1200"
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div className="form-group">
                          <label>Termin Tarihi *</label>
                          <input
                            type="date"
                            value={quotedDeadline}
                            onChange={(e) => setQuotedDeadline(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Not</label>
                        <textarea
                          value={quotedNote}
                          onChange={(e) => setQuotedNote(e.target.value)}
                          placeholder="Opsiyonel açıklama..."
                          rows={2}
                        />
                      </div>
                      <div className="request-actions">
                        <button 
                          className="btn-cancel"
                          onClick={() => {
                            setQuotingRequestId(null)
                            setQuotedPrice('')
                            setQuotedDeadline('')
                            setQuotedNote('')
                          }}
                          disabled={loading}
                        >
                          İptal
                        </button>
                        <button 
                          className="btn-accept"
                          onClick={() => handleQuoteRevision(request.id)}
                          disabled={loading || !quotedPrice || !quotedDeadline}
                        >
                          <CheckCircle size={16} />
                          Teklif Gönder
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="request-actions">
                      <button 
                        className="btn-accept"
                        onClick={() => setQuotingRequestId(request.id)}
                        disabled={loading}
                      >
                        <CheckCircle size={16} />
                        Fiyat & Termin Teklif Et
                      </button>
                      <button 
                        className="btn-reject"
                        onClick={() => handleRejectRevision(request.id)}
                        disabled={loading}
                      >
                        <XCircle size={16} />
                        Reddet
                      </button>
                    </div>
                  )}
                </>
              )}

              {userRole === 'customer' && request.status === 'pending' && (
                <div className="request-actions">
                  <button 
                    className="btn-cancel"
                    onClick={() => handleCancelRevision(request.id)}
                    disabled={loading}
                  >
                    <XCircle size={16} />
                    İptal Et
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Awaiting Customer Approval */}
      {revisionRequests.filter(r => r.status === 'awaiting_customer_approval').length > 0 && (
        <div className="pending-requests awaiting-approval">
          <h4>Müşteri Onayı Bekleyen Talepler</h4>
          {revisionRequests.filter(r => r.status === 'awaiting_customer_approval').map(request => (
            <div key={request.id} className="revision-request awaiting">
              <div className="request-header">
                {getStatusIcon('pending')}
                <span className="request-type">
                  {request.revision_type === 'geometry' ? '🔧 Geometri Revizyonu' : 
                   request.revision_type === 'quantity' ? '📦 Adet Revizyonu' : 
                   '🔧📦 Geometri + Adet Revizyonu'}
                </span>
                <span className="request-revision">{request.from_revision} → {request.to_revision}</span>
                <span className="status-label" style={{ color: '#f59e0b' }}>Müşteri Onayı Bekliyor</span>
              </div>
              
              <div className="request-body">
                <p className="request-description">{request.description}</p>
                
                {/* Supplier Quotation */}
                <div className="supplier-quotation">
                  <h5>Tedarikçi Teklifi:</h5>
                  <div className="quotation-details">
                    <div className="quotation-item">
                      <strong>Fiyat:</strong> {request.supplier_quoted_price?.toLocaleString('tr-TR')}₺
                    </div>
                    <div className="quotation-item">
                      <strong>Termin:</strong> {new Date(request.supplier_quoted_deadline).toLocaleDateString('tr-TR')}
                    </div>
                    {request.supplier_quoted_note && (
                      <div className="quotation-item">
                        <strong>Not:</strong> {request.supplier_quoted_note}
                      </div>
                    )}
                  </div>
                </div>

                {(request.revision_type === 'quantity' || request.revision_type === 'both') && (
                  <div className="quantity-change">
                    <Package size={14} />
                    <span>Adet: {request.old_quantity} → {request.new_quantity}</span>
                  </div>
                )}
              </div>

              {userRole === 'customer' && (
                <div className="request-actions">
                  <button 
                    className="btn-accept"
                    onClick={() => handleAcceptRevision(request.id)}
                    disabled={loading}
                  >
                    <CheckCircle size={16} />
                    Onayla ve Uygula
                  </button>
                  <button 
                    className="btn-reject"
                    onClick={() => handleRejectRevision(request.id)}
                    disabled={loading}
                  >
                    <XCircle size={16} />
                    Reddet
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Completed Requests */}
      {revisionRequests.filter(r => r.status !== 'pending').length > 0 && (
        <div className="completed-requests">
          <div 
            className="completed-requests-header"
            onClick={() => setShowCompletedRequests(!showCompletedRequests)}
          >
            <h4>Tamamlanan Talepler ({revisionRequests.filter(r => r.status !== 'pending').length})</h4>
            {showCompletedRequests ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
          
          {showCompletedRequests && (
            <div className="completed-requests-list">
              {revisionRequests.filter(r => r.status !== 'pending').map(request => (
                <div key={request.id} className={`revision-request ${request.status}`}>
              <div className="request-header">
                {getStatusIcon(request.status)}
                <span className="request-type">
                  {request.revision_type === 'geometry' ? '🔧 Geometri' : 
                   request.revision_type === 'quantity' ? '📦 Adet' : 
                   '🔧📦 Her İkisi'}
                </span>
                    <span className="request-revision">{request.from_revision} → {request.to_revision}</span>
                    <span className="status-label">{getStatusLabel(request.status)}</span>
                  </div>
                  
                  <div className="request-body">
                    <p className="request-description">{request.description}</p>
                    
                    {/* Show supplier quotation for accepted/awaiting requests */}
                    {(request.status === 'accepted' || request.status === 'awaiting_customer_approval') && 
                     request.supplier_quoted_price && (
                      <div className="supplier-quotation compact">
                        <div className="quotation-details">
                          <div className="quotation-item">
                            <strong>Fiyat:</strong> {request.supplier_quoted_price?.toLocaleString('tr-TR')}₺
                          </div>
                          <div className="quotation-item">
                            <strong>Termin:</strong> {new Date(request.supplier_quoted_deadline).toLocaleDateString('tr-TR')}
                          </div>
                          {request.supplier_quoted_note && (
                            <div className="quotation-item">
                              <strong>Not:</strong> {request.supplier_quoted_note}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Show quantity change for accepted quantity or both revisions */}
                    {(request.revision_type === 'quantity' || request.revision_type === 'both') && 
                     request.status === 'accepted' && 
                     request.old_quantity !== null && 
                     request.new_quantity !== null && (
                      <div className="quantity-change accepted">
                        <Package size={14} />
                        <span>Miktar: {request.old_quantity} → {request.new_quantity}</span>
                      </div>
                    )}
                    
                    {request.status === 'rejected' && request.rejection_reason && (
                      <div className="rejection-reason">
                        <AlertCircle size={14} />
                        <span>Red nedeni: {request.rejection_reason}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History */}
      {showHistory && (
        <div className="revision-history">
          <h4>Revizyon Geçmişi</h4>
          {revisionHistory.length === 0 ? (
            <p className="no-history">Henüz revizyon geçmişi yok.</p>
          ) : (
            <div className="history-list">
              {revisionHistory.map(entry => (
                <div key={entry.id} className="history-entry">
                  <div className="history-header">
                    <span className="history-revision">Rev. {entry.revision}</span>
                    <span className="history-type">
                      {entry.revision_type === 'geometry' ? 'Geometri' : 'Adet'}
                    </span>
                    <span className="history-date">
                      {new Date(entry.changed_at).toLocaleString('tr-TR')}
                    </span>
                  </div>
                  <p className="history-summary">{entry.change_summary}</p>
                  <div className="history-changes">
                    <span className="old-value">Eski: {JSON.stringify(entry.old_value)}</span>
                    <span className="new-value">Yeni: {JSON.stringify(entry.new_value)}</span>
                  </div>
                  {entry.checklist_reset && (
                    <div className="checklist-reset-badge">
                      <AlertCircle size={12} />
                      Checklist sıfırlandı
                    </div>
                  )}
                  <div className="history-meta">
                    Değiştiren: {entry.changer?.company_name || entry.changer?.username}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Revizyon Talebi Oluştur</h3>
            
            <div className="form-group">
              <label>Revizyon Tipi</label>
              <select 
                value={revisionType} 
                onChange={(e) => setRevisionType(e.target.value)}
              >
                <option value="geometry">Geometri Revizyonu (Sadece Dosya)</option>
                <option value="quantity">Adet Revizyonu (Sadece Miktar)</option>
                <option value="both">İkisi Birden (Dosya + Miktar)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Açıklama *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Yapılan değişiklikleri açıklayın..."
                rows={4}
                required
              />
            </div>

            {(revisionType === 'geometry' || revisionType === 'both') && (
              <div className="form-group">
                <label>Yeni Dosya *</label>
                <div className="file-input-wrapper">
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    accept=".step,.stp,.pdf,.jpg,.jpeg,.png"
                    required
                  />
                  {newFile && (
                    <div className="file-selected">
                      <FileText size={16} />
                      {newFile.name}
                    </div>
                  )}
                </div>
              </div>
            )}

            {(revisionType === 'quantity' || revisionType === 'both') && (
              <>
                <div className="form-group">
                  <label>Yeni Adet *</label>
                  <input
                    type="number"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    min="1"
                    required
                  />
                  <small>Mevcut adet: {file?.quantity}</small>
                </div>
              </>
            )}

            <div className="modal-actions">
              <button 
                className="btn-cancel"
                onClick={() => {
                  setShowCreateModal(false)
                  resetForm()
                }}
                disabled={uploading}
              >
                İptal
              </button>
              <button 
                className="btn-submit"
                onClick={handleCreateRevision}
                disabled={uploading || !description}
              >
                {uploading ? (
                  <>
                    <Upload size={16} className="spinning" />
                    Yükleniyor...
                  </>
                ) : (
                  'Revizyon Talebi Oluştur'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  )
}

