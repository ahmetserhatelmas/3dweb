import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import API_URL from '../lib/api'
import { 
  ArrowLeft, ArrowRight, Save, Upload, 
  FileBox, Box, LogOut, Users, X, File,
  FileText, FileSpreadsheet, Image, Check, UserPlus
} from 'lucide-react'
import './NewProject.css'

// File type icons
const getFileIcon = (type) => {
  switch (type) {
    case 'step': return <Box size={24} className="file-icon step" />
    case 'dxf': return <Box size={24} className="file-icon dxf" />
    case 'iges': return <Box size={24} className="file-icon iges" />
    case 'parasolid': return <Box size={24} className="file-icon parasolid" />
    case 'pdf': return <FileText size={24} className="file-icon pdf" />
    case 'excel': return <FileSpreadsheet size={24} className="file-icon excel" />
    case 'image': return <Image size={24} className="file-icon image" />
    default: return <File size={24} className="file-icon" />
  }
}

export default function NewProject() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [currentStep, setCurrentStep] = useState(1)
  const [uploadProgress, setUploadProgress] = useState(0)
  
  const isCustomer = user?.role === 'customer'
  const basePath = isCustomer ? '/customer' : '/admin'
  
  // Step 1: Uploaded files
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [tempFolder, setTempFolder] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  
  // Step 2: File details (edited by user)
  // Will be stored in uploadedFiles with additional fields
  
  // Step 3: Project info
  const [projectInfo, setProjectInfo] = useState({
    name: '',
    deadline: '',
    selectedSuppliers: []
  })
  const [showDeadline, setShowDeadline] = useState(false)

  useEffect(() => {
    fetchSuppliers()
  }, [])

  const fetchSuppliers = async () => {
    try {
      // Fetch connected suppliers from the new relationship table
      const res = await fetch(`${API_URL}/api/auth/my-suppliers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        // Transform the data to match the expected format
        const transformedSuppliers = data.map(rel => ({
          id: rel.supplier_id,
          username: rel.supplier_username,
          company_name: rel.supplier_company
        }))
        setSuppliers(transformedSuppliers)
      }
    } catch (error) {
      console.error('Fetch suppliers error:', error)
    }
  }

  // Drag and drop handlers
  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(Array.from(e.dataTransfer.files))
    }
  }, [])

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesUpload(Array.from(e.target.files))
      // Reset input so same file can be selected again
      e.target.value = ''
    }
  }

  const handleFilesUpload = async (files) => {
    // Duplicate file kontrolü (sadece dosya adına göre)
    const duplicateFiles = []
    const newFiles = []
    
    files.forEach(file => {
      const isDuplicate = uploadedFiles.some(
        uploaded => uploaded.file_name === file.name
      )
      
      if (isDuplicate) {
        duplicateFiles.push(file.name)
      } else {
        newFiles.push(file)
      }
    })
    
    // Duplicate dosyalar varsa uyarı göster
    if (duplicateFiles.length > 0) {
      alert(`⚠️ Aşağıdaki dosyalar zaten yüklenmiş:\n\n${duplicateFiles.join('\n')}`)
    }
    
    // Yeni dosya yoksa işlemi durdur
    if (newFiles.length === 0) {
      return
    }
    
    setLoading(true)
    setUploadProgress(10)
    
    try {
      const uploadedNewFiles = []
      const tempId = tempFolder || Date.now().toString()
      setTempFolder(tempId)
      
      // Cloudflare Worker URL
      const workerUrl = 'https://kunye-upload-worker.ahmetserhatelmas-14d.workers.dev'
      
      for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i]
        const progress = ((i + 1) / newFiles.length) * 80 + 10
        setUploadProgress(progress)
        
        // Generate key
        const ext = file.name.substring(file.name.lastIndexOf('.'))
        const key = `temp/${tempId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`
        
        // 1. Get upload URL from Worker
        const workerRes = await fetch(`${workerUrl}/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || 'application/octet-stream',
            key: key
          })
        })
        
        if (!workerRes.ok) {
          throw new Error(`Worker URL alınamadı: ${file.name}`)
        }
        
        const { uploadUrl, publicUrl } = await workerRes.json()
        
        // 2. Upload directly to Worker
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'application/octet-stream'
          },
          body: file
        })
        
        if (!uploadRes.ok) {
          throw new Error(`Dosya yüklenemedi: ${file.name}`)
        }
        
        // 3. Determine file type
        const fileExt = ext.toLowerCase()
        let fileType = 'other'
        if (['.step', '.stp'].includes(fileExt)) fileType = 'step'
        else if (fileExt === '.dxf') fileType = 'dxf'
        else if (['.igs', '.iges'].includes(fileExt)) fileType = 'iges'
        else if (['.x_t', '.x_b', '.xmt_txt', '.xmt_bin'].includes(fileExt)) fileType = 'parasolid'
        else if (fileExt === '.pdf') fileType = 'pdf'
        else if (['.xlsx', '.xls'].includes(fileExt)) fileType = 'excel'
        else if (['.jpg', '.jpeg', '.png'].includes(fileExt)) fileType = 'image'
        
        // 4. Add to uploaded files list
        uploadedNewFiles.push({
          temp_path: key,
          file_url: publicUrl,
          file_name: file.name,
          file_type: fileType,
          file_size: file.size,
          mime_type: file.type,
          description: '',
          quantity: ['step', 'dxf', 'iges', 'parasolid'].includes(fileType) ? '' : null,
          notes: ''
        })
      }
      
      setUploadedFiles(prev => [...prev, ...uploadedNewFiles])
      setUploadProgress(100)
      
    } catch (error) {
      console.error('Upload error:', error)
      alert(error.message)
    } finally {
      setLoading(false)
      setTimeout(() => setUploadProgress(0), 500)
    }
  }

  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const updateFileDetail = (index, field, value) => {
    setUploadedFiles(prev => prev.map((file, i) => 
      i === index ? { ...file, [field]: value } : file
    ))
  }

  const toggleSupplier = (supplierId) => {
    setProjectInfo(prev => ({
      ...prev,
      selectedSuppliers: prev.selectedSuppliers.includes(supplierId)
        ? prev.selectedSuppliers.filter(id => id !== supplierId)
        : [...prev.selectedSuppliers, supplierId]
    }))
  }

  const handleAddNewSupplier = async (e) => {
    e.preventDefault()
    setSavingSupplier(true)

    try {
      const res = await fetch(`${API_URL}/api/auth/register-supplier`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newSupplierForm)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Tedarikçi eklenemedi')
      }

      const newSupplier = await res.json()
      
      // Refresh suppliers list
      await fetchSuppliers()
      
      // Auto-select the new supplier
      setProjectInfo(prev => ({
        ...prev,
        selectedSuppliers: [...prev.selectedSuppliers, newSupplier.id]
      }))
      
      // Close modal and reset form
      setShowNewSupplierModal(false)
      setNewSupplierForm({
        username: '',
        password: '',
        company_name: '',
        email: ''
      })
      
      alert('Tedarikçi başarıyla eklendi ve projeye atandı!')
    } catch (error) {
      alert(error.message)
    } finally {
      setSavingSupplier(false)
    }
  }

  const handleSubmit = async () => {
    // Validate CAD files have quantity
    const cadFileTypes = ['step', 'dxf', 'iges', 'parasolid']
    const cadFilesWithoutQuantity = uploadedFiles.filter(
      file => cadFileTypes.includes(file.file_type) && (!file.quantity || file.quantity < 1)
    )
    
    if (cadFilesWithoutQuantity.length > 0) {
      alert('Lütfen tüm CAD dosyaları için adet belirtin (en az 1).')
      return
    }
    
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: projectInfo.name,
          deadline: projectInfo.deadline || null,
          suppliers: projectInfo.selectedSuppliers,
          files: uploadedFiles,
          use_standard_checklist: true
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }

      navigate(basePath)
    } catch (error) {
      console.error('Create project error:', error)
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  const canProceedToStep2 = uploadedFiles.length > 0
  const canProceedToStep3 = uploadedFiles.length > 0
  const canSubmit = projectInfo.name && projectInfo.selectedSuppliers.length > 0

  // Steps data
  const steps = [
    { number: 1, title: 'Dosya Yükle' },
    { number: 2, title: 'Dosya Detayları' },
    { number: 3, title: 'Proje Bilgileri' }
  ]

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
          <Link to={`${basePath}/users`} className="nav-item">
            <Users size={20} />
            <span>{isCustomer ? 'Tedarikçiler' : 'Kullanıcılar'}</span>
          </Link>
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
            <Link to={basePath} className="back-link">
              <ArrowLeft size={20} />
              Geri Dön
            </Link>
            <h1 className="page-title">Yeni Proje Oluştur</h1>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="wizard-steps">
          {steps.map((step, index) => (
            <div 
              key={step.number}
              className={`wizard-step ${currentStep === step.number ? 'active' : ''} ${currentStep > step.number ? 'completed' : ''}`}
            >
              <div className="step-circle">
                {currentStep > step.number ? <Check size={16} /> : step.number}
              </div>
              <span className="step-title">{step.title}</span>
              {index < steps.length - 1 && <div className="step-line" />}
            </div>
          ))}
        </div>

        <div className="wizard-content animate-slide-up">
          {/* Step 1: File Upload */}
          {currentStep === 1 && (
            <div className="form-section">
              <h2 className="section-title">Proje Dosyalarını Yükleyin</h2>
              <p className="section-desc">STEP, DXF, IGES, Parasolid, PDF, Excel ve resim dosyalarını yükleyebilirsiniz.</p>
              
              <div 
                className={`file-dropzone ${dragActive ? 'active' : ''} ${loading ? 'loading' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  multiple
                  accept=".step,.stp,.dxf,.igs,.iges,.x_t,.x_b,.xmt_txt,.xmt_bin,.pdf,.xlsx,.xls,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  id="file-input"
                  hidden
                />
                <label htmlFor="file-input" className="dropzone-content">
                  <Upload size={48} />
                  <span className="dropzone-text">
                    {loading ? 'Yükleniyor...' : 'Dosyaları sürükleyin veya tıklayın'}
                  </span>
                  <span className="dropzone-hint">
                    STEP, DXF, IGES, Parasolid, PDF, Excel, JPG, PNG (max 500MB)
                  </span>
                </label>
                {uploadProgress > 0 && (
                  <div className="upload-progress">
                    <div className="progress-bar" style={{ width: `${uploadProgress}%` }} />
                  </div>
                )}
              </div>

              {uploadedFiles.length > 0 && (
                <div className="uploaded-files-list">
                  <h3 className="list-title">Yüklenen Dosyalar ({uploadedFiles.length})</h3>
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="uploaded-file-item">
                      {getFileIcon(file.file_type)}
                      <div className="file-details">
                        <span className="file-name">{file.file_name}</span>
                        <span className="file-type-badge">{file.file_type.toUpperCase()}</span>
                      </div>
                      <button 
                        className="remove-file-btn"
                        onClick={() => removeFile(index)}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: File Details */}
          {currentStep === 2 && (
            <div className="form-section">
              <h2 className="section-title">Dosya Detaylarını Düzenleyin</h2>
              <p className="section-desc">Her dosya için açıklama ve not ekleyebilirsiniz.</p>
              
              <div className="file-details-list">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="file-detail-card">
                    <div className="file-detail-header">
                      {getFileIcon(file.file_type)}
                      <span className="file-name">{file.file_name}</span>
              </div>

                    <div className="file-detail-form">
              <div className="input-group">
                        <label>Açıklama</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="Bu dosya ne içeriyor?"
                          value={file.description}
                          onChange={(e) => updateFileDetail(index, 'description', e.target.value)}
                        />
                      </div>
                      
                      {['step', 'dxf', 'iges', 'parasolid'].includes(file.file_type) && (
                        <div className="input-group input-small">
                          <label>Adet *</label>
                <input
                            type="number"
                  className="input"
                            min="1"
                            value={file.quantity || ''}
                            onChange={(e) => updateFileDetail(index, 'quantity', e.target.value ? parseInt(e.target.value) : '')}
                            placeholder="En az 1"
                            required
                          />
                        </div>
                      )}
                      
                      <div className="input-group input-full">
                        <label>Not</label>
                        <textarea
                          className="input textarea"
                          placeholder="Tedarikçi için önemli notlar..."
                          value={file.notes}
                          onChange={(e) => updateFileDetail(index, 'notes', e.target.value)}
                          rows={2}
                />
              </div>
            </div>
          </div>
                ))}
          </div>
            </div>
          )}

          {/* Step 3: Project Info */}
          {currentStep === 3 && (
            <div className="form-section">
              <h2 className="section-title">Proje Bilgilerini Girin</h2>
              
              <div className="form-grid">
                <div className="input-group input-full">
                  <label htmlFor="name">Proje Adı *</label>
                  <input
                    type="text"
                    id="name"
                    className="input"
                    value={projectInfo.name}
                    onChange={(e) => setProjectInfo(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Örn: Hidrolik Valf Gövdesi Üretimi"
                    required
                  />
                </div>

                <div className="input-group">
                  {!showDeadline ? (
                    <button 
                      type="button"
                      className="add-deadline-btn"
                      onClick={() => setShowDeadline(true)}
                    >
                      + Termin Tarihi Gir <span style={{ opacity: 0.6, fontSize: '0.9em' }}>(Zorunlu Değil)</span>
                    </button>
                  ) : (
                    <div>
                      <label htmlFor="deadline">Termin Tarihi</label>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="date"
                          id="deadline"
                          className="input"
                          value={projectInfo.deadline}
                          onChange={(e) => setProjectInfo(prev => ({ ...prev, deadline: e.target.value }))}
                          style={{ flex: 1 }}
                        />
                        <button 
                          type="button"
                          className="remove-deadline-btn"
                          onClick={() => {
                            setShowDeadline(false)
                            setProjectInfo(prev => ({ ...prev, deadline: '' }))
                          }}
                          title="Termin tarihini kaldır"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="suppliers-section">
                <div className="suppliers-header">
                  <label>Tedarikçiler * (birden fazla seçebilirsiniz)</label>
                </div>
                <div className="suppliers-grid">
                  {suppliers.map(supplier => (
                    <div 
                      key={supplier.id}
                      className={`supplier-card ${projectInfo.selectedSuppliers.includes(supplier.id) ? 'selected' : ''}`}
                      onClick={() => toggleSupplier(supplier.id)}
                    >
                      <div className="supplier-check">
                        {projectInfo.selectedSuppliers.includes(supplier.id) && <Check size={16} />}
                      </div>
                      <div className="supplier-info">
                        <span className="supplier-name">{supplier.company_name}</span>
                        <span className="supplier-username">@{supplier.username}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {suppliers.length === 0 && (
                  <div className="no-suppliers-box">
                    <Users size={32} />
                    <p>Henüz bağlı tedarikçiniz yok</p>
                    <p className="hint">Dashboard'dan davet linkinizi paylaşarak tedarikçi ekleyebilirsiniz</p>
                  </div>
                )}
              </div>

              <div className="checklist-info">
                <Check size={20} />
                <span>Standart kontrol listesi otomatik eklenecek</span>
              </div>
            </div>
          )}
          </div>

        {/* Navigation Buttons */}
        <div className="wizard-actions">
          {currentStep > 1 && (
            <button 
              className="btn btn-secondary"
              onClick={() => setCurrentStep(prev => prev - 1)}
            >
              <ArrowLeft size={18} />
              Geri
            </button>
          )}
          
          <div className="wizard-actions-right">
            <Link to={basePath} className="btn btn-secondary">
              İptal
            </Link>
            
            {currentStep < 3 ? (
              <button 
                className="btn btn-primary"
                onClick={() => {
                  // Step 2'den 3'e geçerken adet kontrolü yap
                  if (currentStep === 2) {
                    const cadFileTypes = ['step', 'dxf', 'iges', 'parasolid']
                    const cadFilesWithoutQuantity = uploadedFiles.filter(
                      file => cadFileTypes.includes(file.file_type) && (!file.quantity || file.quantity < 1)
                    )
                    
                    if (cadFilesWithoutQuantity.length > 0) {
                      alert('Lütfen tüm CAD dosyaları için adet belirtin (en az 1).')
                      return
                    }
                  }
                  setCurrentStep(prev => prev + 1)
                }}
                disabled={currentStep === 1 && !canProceedToStep2}
              >
                İleri
                <ArrowRight size={18} />
              </button>
            ) : (
              <button 
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={!canSubmit || loading}
              >
                {loading ? 'Oluşturuluyor...' : (
                <>
                  <Save size={18} />
                  Projeyi Oluştur
                </>
              )}
            </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
