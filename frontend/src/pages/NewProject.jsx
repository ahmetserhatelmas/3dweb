import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import API_URL from '../lib/api'
import { 
  ArrowLeft, Save, Plus, Trash2, Upload, 
  FileBox, Box, LogOut, Users
} from 'lucide-react'
import './NewProject.css'

export default function NewProject() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [stepFile, setStepFile] = useState(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  
  const isCustomer = user?.role === 'customer'
  const basePath = isCustomer ? '/customer' : '/admin'
  
  const [form, setForm] = useState({
    name: '',
    part_number: '',
    assigned_to: '',
    deadline: '',
    checklist: ['']
  })

  useEffect(() => {
    fetchSuppliers()
  }, [])

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/suppliers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setSuppliers(data)
      }
    } catch (error) {
      console.error('Fetch suppliers error:', error)
    }
  }

  const handleAddChecklistItem = () => {
    setForm(prev => ({
      ...prev,
      checklist: [...prev.checklist, '']
    }))
  }

  const handleRemoveChecklistItem = (index) => {
    setForm(prev => ({
      ...prev,
      checklist: prev.checklist.filter((_, i) => i !== index)
    }))
  }

  const handleChecklistChange = (index, value) => {
    setForm(prev => ({
      ...prev,
      checklist: prev.checklist.map((item, i) => i === index ? value : item)
    }))
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setStepFile(file)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      console.log('🚀 Starting project creation...')
      console.log('📎 STEP file:', stepFile ? stepFile.name : 'NO FILE')
      
      // Filter out empty checklist items
      const checklist = form.checklist.filter(item => item.trim() !== '')

      // Create project
      console.log('📤 Creating project...')
      const res = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...form,
          assigned_to: form.assigned_to, // UUID olarak gönder
          checklist
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }

      const { id: projectId } = await res.json()
      console.log('✅ Project created:', projectId)

      // Upload STEP file if selected
      if (stepFile) {
        console.log('📤 Uploading STEP file...')
        setUploadingFile(true)
        const formData = new FormData()
        formData.append('file', stepFile)

        const uploadRes = await fetch(`${API_URL}/api/upload/step/${projectId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        })
        
        if (!uploadRes.ok) {
          console.error('❌ Upload failed:', await uploadRes.text())
        } else {
          console.log('✅ STEP file uploaded successfully')
        }
      } else {
        console.log('⚠️ No STEP file to upload')
      }

      navigate(basePath)
    } catch (error) {
      console.error('❌ Error:', error)
      alert(error.message)
    } finally {
      setLoading(false)
      setUploadingFile(false)
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
            <p className="page-subtitle">
              {isCustomer ? 'Tedarikçinize atanacak yeni bir iş tanımlayın' : 'Tedarikçiye atanacak yeni bir iş tanımlayın'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="new-project-form animate-slide-up">
          <div className="form-section">
            <h2 className="section-title">Proje Bilgileri</h2>
            
            <div className="form-grid">
              <div className="input-group">
                <label htmlFor="name">Proje Adı *</label>
                <input
                  type="text"
                  id="name"
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Örn: Hidrolik Valf Gövdesi"
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="part_number">Parça Numarası *</label>
                <input
                  type="text"
                  id="part_number"
                  className="input"
                  value={form.part_number}
                  onChange={(e) => setForm(prev => ({ ...prev, part_number: e.target.value }))}
                  placeholder="Örn: HV-2024-001"
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="assigned_to">Tedarikçi *</label>
                <select
                  id="assigned_to"
                  className="input"
                  value={form.assigned_to}
                  onChange={(e) => setForm(prev => ({ ...prev, assigned_to: e.target.value }))}
                  required
                >
                  <option value="">Tedarikçi Seçin</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.company_name} ({s.username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label htmlFor="deadline">Termin Tarihi</label>
                <input
                  type="date"
                  id="deadline"
                  className="input"
                  value={form.deadline}
                  onChange={(e) => setForm(prev => ({ ...prev, deadline: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2 className="section-title">3D Model (STEP Dosyası)</h2>
            
            <label className={`file-upload ${stepFile ? 'active' : ''}`}>
              <input
                type="file"
                accept=".step,.stp"
                onChange={handleFileChange}
              />
              <Upload size={32} />
              {stepFile ? (
                <div className="file-info">
                  <span className="file-name">{stepFile.name}</span>
                  <span className="file-size">
                    {(stepFile.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              ) : (
                <>
                  <span>STEP dosyasını sürükleyin veya seçin</span>
                  <span className="file-hint">.step veya .stp formatı</span>
                </>
              )}
            </label>
          </div>

          <div className="form-section">
            <div className="section-header">
              <h2 className="section-title">Kontrol Listesi (Checklist)</h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAddChecklistItem}
              >
                <Plus size={16} />
                Madde Ekle
              </button>
            </div>
            
            <div className="checklist-items">
              {form.checklist.map((item, index) => (
                <div key={index} className="checklist-input-row">
                  <span className="checklist-number">{index + 1}</span>
                  <input
                    type="text"
                    className="input"
                    value={item}
                    onChange={(e) => handleChecklistChange(index, e.target.value)}
                    placeholder="Örn: Malzeme Sertifikası Yükle"
                  />
                  {form.checklist.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => handleRemoveChecklistItem(index)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <Link to={basePath} className="btn btn-secondary">
              İptal
            </Link>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (uploadingFile ? 'Dosya yükleniyor...' : 'Kaydediliyor...') : (
                <>
                  <Save size={18} />
                  Projeyi Oluştur
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

