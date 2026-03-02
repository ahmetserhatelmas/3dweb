import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import API_URL from '../lib/api'
import { 
  ArrowLeft, ArrowRight, Check, Upload, FileText, Download,
  Calendar, Building2, User as UserIcon, Clock, CheckCircle, Trash2,
  Box, FileSpreadsheet, Image, File, X, Eye, ChevronLeft, MessageSquare, Send,
  DollarSign, CheckCheck, XCircle, CheckSquare, Plus, ChevronDown, ChevronRight, Filter
} from 'lucide-react'
import StepViewer from '../components/StepViewer'
import DxfViewer from '../components/DxfViewer'
import '../components/DxfViewer.css'
import { RevisionManager } from '../components/RevisionManager'
import './ProjectDetail.css'

// File categories for filtering (Proje Dosyaları) — sadece aktif dosyalar; pasifler ayrı sekmede
const FILE_CATEGORIES = {
  all: { key: 'all', label: 'Tümü', types: null },
  work: { key: 'work', label: 'Çalışma dosyaları', types: ['step', 'stl', 'dxf', 'iges', 'parasolid'] },
  pdf: { key: 'pdf', label: 'PDF', types: ['pdf'] },
  excel: { key: 'excel', label: 'Excel', types: ['excel'] },
  image: { key: 'image', label: 'Resim', types: ['image'] },
  document: { key: 'document', label: 'Sözleşme / Döküman', types: ['document'] },
  other: { key: 'other', label: 'Diğer', types: ['other'] },
  pasif: { key: 'pasif', label: 'Pasif dosyalar', types: null }
}
const getFileCategory = (fileType) => {
  if (!fileType) return 'other'
  for (const [key, cat] of Object.entries(FILE_CATEGORIES)) {
    if (key === 'all') continue
    if (cat.types && cat.types.includes(fileType.toLowerCase())) return key
  }
  return 'other'
}

// File type icons
const getFileIcon = (type) => {
  switch (type) {
    case 'step': return <Box size={20} className="file-icon step" />
    case 'stl': return <Box size={20} className="file-icon stl" />
    case 'dxf': return <Box size={20} className="file-icon dxf" />
    case 'iges': return <Box size={20} className="file-icon iges" />
    case 'parasolid': return <Box size={20} className="file-icon parasolid" />
    case 'pdf': return <FileText size={20} className="file-icon pdf" />
    case 'excel': return <FileSpreadsheet size={20} className="file-icon excel" />
    case 'image': return <Image size={20} className="file-icon image" />
    default: return <File size={20} className="file-icon" />
  }
}

// Helper function to get deadline status
const getDeadlineStatus = (deadlineDate) => {
  if (!deadlineDate) return 'normal'
  
  const now = new Date()
  const deadline = new Date(deadlineDate)
  const diffTime = deadline - now
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) return 'overdue' // Tarih geçmiş - Kırmızı + Arka plan
  if (diffDays <= 10) return 'urgent' // 10 gün veya daha az - Kırmızı
  return 'warning' // Normal - Sarı
}

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, token } = useAuth()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [deletingDoc, setDeletingDoc] = useState(null)
  
  // New: Active file view
  const [activeFile, setActiveFile] = useState(null) // Currently selected file
  const [viewMode, setViewMode] = useState('files') // 'files' | 'viewer'
  
  // Supplier notes
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  
  // Quotations (for customer)
  const [quotations, setQuotations] = useState([])
  const [loadingQuotations, setLoadingQuotations] = useState(false)
  const [processingQuotation, setProcessingQuotation] = useState(null)
  const [deletingProject, setDeletingProject] = useState(false)
  const [showQuotationDetailsModal, setShowQuotationDetailsModal] = useState(false)
  const [quotationsPanelExpanded, setQuotationsPanelExpanded] = useState(true)
  
  // Customer notes on quotations
  const [editingCustomerNote, setEditingCustomerNote] = useState(null) // supplier_id being edited
  const [customerNoteText, setCustomerNoteText] = useState('')
  const [savingCustomerNote, setSavingCustomerNote] = useState(false)
  
  // Sub-checklist management
  const [expandedItems, setExpandedItems] = useState({})
  const [addingSubItem, setAddingSubItem] = useState(null) // parent item id
  const [newSubItemTitle, setNewSubItemTitle] = useState('')
  const [savingSubItem, setSavingSubItem] = useState(false)

  // Proje dosyaları filtre (kategori)
  const [fileCategoryFilter, setFileCategoryFilter] = useState('all')

  const fetchProject = async () => {
    try {
      const res = await fetch(`${API_URL}/api/projects/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        console.log('Project files loaded:', data.project_files?.map(f => ({ 
          id: f.id, 
          name: f.file_name, 
          revision: f.revision, 
          is_active: f.is_active 
        })))
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

  // Fetch quotations for customer
  useEffect(() => {
    if (user.role === 'customer' && project?.is_quotation) {
      fetchQuotations()
    }
  }, [project?.is_quotation, user.role])

  const fetchQuotations = async () => {
    setLoadingQuotations(true)
    try {
      const res = await fetch(`${API_URL}/api/projects/${id}/quotations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setQuotations(data)
      }
    } catch (error) {
      console.error('Fetch quotations error:', error)
    } finally {
      setLoadingQuotations(false)
    }
  }

  const handleAcceptQuotation = async (supplierId) => {
    if (!confirm('Bu teklifi kabul etmek istediğinize emin misiniz? Diğer teklifler reddedilecektir.')) {
      return
    }

    setProcessingQuotation(supplierId)
    try {
      const res = await fetch(`${API_URL}/api/projects/${id}/quotations/${supplierId}/accept`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (res.ok) {
        alert('Teklif kabul edildi! Proje tedarikçiye atandı.')
        fetchProject()
        fetchQuotations()
      } else {
        const data = await res.json()
        alert(data.error || 'İşlem başarısız.')
      }
    } catch (error) {
      console.error('Accept quotation error:', error)
      alert('Bir hata oluştu.')
    } finally {
      setProcessingQuotation(null)
    }
  }

  const handleRejectQuotation = async (supplierId) => {
    if (!confirm('Bu teklifi reddetmek istediğinize emin misiniz?')) {
      return
    }

    setProcessingQuotation(supplierId)
    try {
      const res = await fetch(`${API_URL}/api/projects/${id}/quotations/${supplierId}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (res.ok) {
        alert('Teklif reddedildi.')
        fetchQuotations()
      } else {
        const data = await res.json()
        alert(data.error || 'İşlem başarısız.')
      }
    } catch (error) {
      console.error('Reject quotation error:', error)
      alert('Bir hata oluştu.')
    } finally {
      setProcessingQuotation(null)
    }
  }

  // Customer note functions
  const handleStartEditCustomerNote = (supplierId, currentNote) => {
    setEditingCustomerNote(supplierId)
    setCustomerNoteText(currentNote || '')
  }

  const handleCancelCustomerNote = () => {
    setEditingCustomerNote(null)
    setCustomerNoteText('')
  }

  const handleExtendDeadline = async (supplierId) => {
    if (!confirm('Bu tedarikçiye 1 gün ek süre vermek istediğinize emin misiniz?')) return
    setProcessingQuotation(supplierId)
    try {
      const res = await fetch(`${API_URL}/api/projects/${id}/quotations/${supplierId}/extend-deadline`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        alert('1 gün ek süre verildi.')
        fetchQuotations()
      } else {
        const data = await res.json()
        alert(data.error || 'İşlem başarısız.')
      }
    } catch (e) {
      alert('Bir hata oluştu.')
    } finally {
      setProcessingQuotation(null)
    }
  }

  const formatQuoteTimeLeft = (quoteDueAt) => {
    if (!quoteDueAt) return null
    const due = new Date(quoteDueAt).getTime()
    const now = Date.now()
    if (due <= now) return { expired: true, text: 'Süresi doldu' }
    const ms = due - now
    const days = Math.floor(ms / (24 * 60 * 60 * 1000))
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    if (days > 0) return { expired: false, text: `${days} gün ${hours} saat kaldı` }
    if (hours > 0) return { expired: false, text: `${hours} saat kaldı` }
    const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
    return { expired: false, text: `${mins} dakika kaldı` }
  }

  const handleSaveCustomerNote = async (supplierId) => {
    setSavingCustomerNote(true)
    try {
      const res = await fetch(`${API_URL}/api/projects/${id}/quotations/${supplierId}/note`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ customer_note: customerNoteText })
      })

      if (res.ok) {
        alert('Not kaydedildi.')
        setEditingCustomerNote(null)
        setCustomerNoteText('')
        fetchQuotations()
      } else {
        const data = await res.json()
        alert(data.error || 'Not kaydedilemedi.')
      }
    } catch (error) {
      console.error('Save customer note error:', error)
      alert('Bir hata oluştu.')
    } finally {
      setSavingCustomerNote(false)
    }
  }

  // Delete entire project
  const handleDeleteProject = async () => {
    if (!confirm(`"${project.name}" projesini tamamen silmek istediğinize emin misiniz? Bu işlem geri alınamaz!`)) {
      return
    }

    setDeletingProject(true)
    try {
      const res = await fetch(`${API_URL}/api/projects/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (res.ok) {
        alert('Proje başarıyla silindi.')
        navigate(user.role === 'admin' ? '/admin' : '/customer')
      } else {
        const data = await res.json()
        alert(data.error || 'Proje silinemedi.')
      }
    } catch (error) {
      console.error('Delete project error:', error)
      alert('Bir hata oluştu.')
    } finally {
      setDeletingProject(false)
    }
  }

  const handleChecklistChange = async (itemId, checked, isChild = false, parentId = null) => {
    // Optimistic update - UI'ı hemen güncelle (synchronous, instant)
    const updateChecklist = (items) => {
      return items.map(item => {
        // If this is the item being updated (direct update)
        if (item.id === itemId) {
          return { ...item, is_checked: checked }
        }
        
        // Update children if this parent has children
        if (item.children && item.children.length > 0) {
          const updatedChildren = item.children.map(child => 
            child.id === itemId ? { ...child, is_checked: checked } : child
          )
          
          // Calculate parent state based on children
          const allChildrenChecked = updatedChildren.length > 0 && updatedChildren.every(c => c.is_checked)
          const hasAnyChildren = updatedChildren.length > 0
          
          // If all children are checked, parent must be checked
          // If any child is unchecked, parent must be unchecked
          return {
            ...item,
            children: updatedChildren,
            is_checked: hasAnyChildren ? allChildrenChecked : item.is_checked
          }
        }
        
        return item
      })
    }

    // Also update file_checklists if this is a file checklist item
    const updateFileChecklists = (fileChecklists) => {
      if (!fileChecklists) return fileChecklists
      const updated = { ...fileChecklists }
      for (const fileId in updated) {
        updated[fileId] = updateChecklist(updated[fileId])
      }
      return updated
    }

    // Immediately update UI - no waiting
    setProject(prev => ({
      ...prev,
      checklist: updateChecklist(prev.checklist),
      file_checklists: updateFileChecklists(prev.file_checklists)
    }))

    // API call in background - don't block UI
    fetch(`${API_URL}/api/projects/${id}/checklist/${itemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ is_checked: checked })
    })
      .then(async (res) => {
        if (res.ok) {
          // Success - optimistic update is already applied and correct
          // Don't update state from backend response to prevent flickering
          // The optimistic update logic already handles parent state correctly
          await res.json() // Consume response but don't use it
        } else {
          // On error, revert by fetching fresh data (silently in background)
          const errorData = await res.json()
          console.error('Checklist update failed:', errorData)
          fetchProject()
        }
      })
      .catch((error) => {
        console.error('Update checklist error:', error)
        // On error, revert by fetching fresh data (silently in background)
        fetchProject()
      })
  }

  // Toggle expanded state for hierarchical items
  const toggleExpanded = (itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }))
  }

  // Add sub-checklist item
  const handleAddSubItem = async (parentId, fileId = null) => {
    if (!newSubItemTitle.trim()) {
      setAddingSubItem(null)
      setNewSubItemTitle('')
      return
    }

    setSavingSubItem(true)
    try {
      const res = await fetch(`${API_URL}/api/projects/${id}/checklist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          title: newSubItemTitle.trim(),
          parent_id: parentId,
          file_id: fileId
        })
      })

      if (res.ok) {
        setAddingSubItem(null)
        setNewSubItemTitle('')
        fetchProject() // Refresh to get updated checklist
      } else {
        const data = await res.json()
        alert(data.error || 'Alt madde eklenemedi.')
      }
    } catch (error) {
      console.error('Add sub-item error:', error)
      alert('Bir hata oluştu.')
    } finally {
      setSavingSubItem(false)
    }
  }

  // Handle supplier note
  const handleSaveNote = async (itemId) => {
    if (!noteText.trim()) {
      setEditingNoteId(null)
      setNoteText('')
      return
    }

    setSavingNote(true)
    
    // Optimistic update
    const now = new Date().toISOString()
    setProject(prev => ({
      ...prev,
      checklist: prev.checklist.map(item => 
        item.id === itemId ? { ...item, supplier_notes: noteText, supplier_notes_at: now } : item
      )
    }))

    try {
      const res = await fetch(`${API_URL}/api/projects/${id}/checklist/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ supplier_notes: noteText })
      })

      if (!res.ok) {
        console.error('Note save failed')
        // Revert on error
        fetchProject()
      }
    } catch (error) {
      console.error('Save note error:', error)
      fetchProject()
    } finally {
      setSavingNote(false)
      setEditingNoteId(null)
      setNoteText('')
    }
  }

  const startEditingNote = (item) => {
    setEditingNoteId(item.id)
    setNoteText(item.supplier_notes || '')
  }

  const cancelEditingNote = () => {
    setEditingNoteId(null)
    setNoteText('')
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
    console.log('Delete clicked:', docId, docName)
    
    const confirmed = window.confirm(`"${docName}" dökümanını silmek istediğinize emin misiniz?`)
    console.log('Confirm result:', confirmed)
    
    if (!confirmed) {
      console.log('User cancelled')
      return
    }

    console.log('Starting delete...')
    setDeletingDoc(docId)
    
    const url = `${API_URL}/api/projects/${id}/documents/${docId}`
    console.log('DELETE URL:', url)
    console.log('Token:', token ? 'exists' : 'missing')
    
    try {
      console.log('Sending fetch request...')
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      console.log('Response status:', res.status)

      if (res.ok) {
        console.log('Delete successful, refreshing...')
        fetchProject()
      } else {
        const data = await res.json()
        console.log('Delete failed:', data)
        alert(data.error)
      }
    } catch (error) {
      console.error('Delete document error:', error)
      alert('Döküman silinirken hata oluştu.')
    } finally {
      console.log('Delete finished')
      setDeletingDoc(null)
    }
  }

  // Count only parent items (no parent_id) for progress - children don't count separately
  const parentItems = project?.checklist || []
  const allChecked = parentItems.every(item => !!item.is_checked)
  const checkedCount = parentItems.filter(item => !!item.is_checked).length || 0
  const totalCount = parentItems.length || 0
  
  // Check if there are any inactive or pending files in the project
  const hasInactiveFiles = project?.project_files?.some(file => file.is_active === false) || false
  const hasPendingFiles = project?.project_files?.some(file => file.status === 'pending') || false
  const hasProblematicFiles = hasInactiveFiles || hasPendingFiles

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { label: 'Bekliyor', class: 'badge-pending', icon: Clock },
      reviewing: { label: 'İnceleniyor', class: 'badge-reviewing', icon: Clock },
      completed: { label: 'Tamamlandı', class: 'badge-completed', icon: CheckCircle }
    }
    return statusMap[status] || statusMap.pending
  }

  // CRITICAL: ALL hooks must be called BEFORE any early returns (React Hooks rule)
  // Optimize file grouping with useMemo - ALWAYS called (hooks rule)
  const { activeFilesWithPreviews, inactiveFiles } = useMemo(() => {
    // Safety check
    if (!project || !project.project_files || !Array.isArray(project.project_files)) {
      return { activeFilesWithPreviews: [], inactiveFiles: [] }
    }
    
    // Quick filter: active files (including pending) vs inactive
    const activeFiles = []
    const pendingFiles = []
    const inactiveFiles = []
    
    for (const file of project.project_files) {
      if (!file || !file.id) continue
      
      if (file.status === 'pending') {
        pendingFiles.push(file)
      } else if (file.is_active === false) {
        inactiveFiles.push(file)
      } else {
        activeFiles.push(file)
      }
    }
    
    // Quick map: parent_id -> pending files
    const pendingMap = new Map()
    for (const pending of pendingFiles) {
      if (pending.parent_file_id) {
        const parentId = String(pending.parent_file_id)
        if (!pendingMap.has(parentId)) {
          pendingMap.set(parentId, [])
        }
        pendingMap.get(parentId).push(pending)
      }
    }
    
    // Attach pending files to their parents
    const activeFilesWithPreviews = activeFiles.map(file => ({
      file,
      pendingPreviews: pendingMap.get(String(file.id)) || []
    }))
    
    return { activeFilesWithPreviews, inactiveFiles }
  }, [project?.project_files])

  // Group files by category — sadece AKTİF dosyalar; pasifler ayrı "Pasif dosyalar" sekmesinde
  const { groupedByCategory, filteredFilesWithPreviews } = useMemo(() => {
    const categories = { work: [], pdf: [], excel: [], image: [], document: [], other: [] }
    const push = (entry) => {
      const cat = getFileCategory(entry.file?.file_type ?? entry.file_type)
      if (categories[cat]) categories[cat].push(entry)
    }
    activeFilesWithPreviews.forEach(({ file, pendingPreviews }) => {
      push({ file, pendingPreviews, isActive: true })
    })
    const filterKey = fileCategoryFilter
    const catDef = FILE_CATEGORIES[filterKey]
    let filtered = null
    if (filterKey === 'pasif') {
      filtered = inactiveFiles.map(file => ({ file, pendingPreviews: [], isActive: false }))
    } else if (filterKey !== 'all') {
      let list
      if (catDef?.types) {
        list = activeFilesWithPreviews.filter(({ file }) => catDef.types.includes(file.file_type))
      } else {
        list = activeFilesWithPreviews.filter(({ file }) => getFileCategory(file.file_type) === 'other')
      }
      filtered = list.map(({ file, pendingPreviews }) => ({ file, pendingPreviews, isActive: true }))
    }
    return { groupedByCategory: categories, filteredFilesWithPreviews: filtered }
  }, [activeFilesWithPreviews, inactiveFiles, fileCategoryFilter])
  
  // Early returns AFTER all hooks (React Hooks rule)
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
  
  // Check if project has new multi-file structure
  const hasProjectFiles = project?.project_files && project.project_files.length > 0
  
  // Get back link based on role
  const getBackLink = () => {
    if (user.role === 'admin') return '/admin'
    if (user.role === 'customer') return '/customer'
    return '/dashboard'
  }

  // Handle file click
  const handleFileClick = (file) => {
    setActiveFile(file)
    setViewMode('viewer')
    
    // Auto-expand all parent items for file checklist when viewing a CAD file
    if (['step', 'dxf', 'iges', 'parasolid'].includes(file?.file_type) && project?.file_checklists?.[file.id]) {
      const newExpanded = {}
      project.file_checklists[file.id].forEach(item => {
        if (item.children && item.children.length > 0) {
          newExpanded[item.id] = true // Auto-expand all parent items
        }
      })
      setExpandedItems(prev => ({ ...prev, ...newExpanded }))
    }
  }

  // Go back to files list
  const handleBackToFiles = () => {
    setActiveFile(null)
    setViewMode('files')
  }

  // R2: pub-xxx.r2.dev hem backend hem tarayıcıda TLS hatası verebiliyor; her zaman backend stream kullan (Worker veya curl).
  const renderFilePreview = (file, opts = {}) => {
    if (!file) return null
    const useStream = opts.projectId && opts.fileId && opts.token
    const streamUrl = useStream ? `${API_URL}/api/projects/${opts.projectId}/files/${opts.fileId}/stream` : null
    const fetchOptions = useStream ? { headers: { Authorization: `Bearer ${opts.token}` } } : undefined
    const fileUrl = streamUrl || file.file_url

    switch (file.file_type) {
      case 'step':
        return <StepViewer fileUrl={fileUrl} fetchOptions={fetchOptions} />
      case 'dxf':
        return <DxfViewer fileUrl={fileUrl} fileName={file.file_name} fetchOptions={fetchOptions} />
      case 'iges':
      case 'parasolid':
        return (
          <div className="file-preview-placeholder">
            <Box size={64} />
            <p>{file.file_name}</p>
            <p className="file-type-note">Bu dosya türü için önizleme desteklenmiyor</p>
            <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              <Download size={18} />
              Dosyayı İndir
            </a>
          </div>
        )
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

  return (
    <div className="project-detail-page">
      <header className="detail-header">
        <div className="header-left">
          <Link to={getBackLink()} className="back-link">
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
              {project.part_number && (
                <span className="meta-item">
                  <FileText size={16} />
                  {project.part_number}
                </span>
              )}
              <span className="meta-item">
                <Building2 size={16} />
                {project.project_suppliers && project.project_suppliers.length > 0 ? (
                  project.status === 'pending' && project.is_quotation ? (
                    // Bekliyor: Tüm atanan tedarikçileri göster
                    project.project_suppliers.map(ps => ps.supplier?.company_name || ps.supplier?.username).filter(Boolean).join(', ')
                  ) : (
                    // Kabul edildi veya teklif değil: Sadece accepted olanı göster
                    project.project_suppliers.find(ps => ps.status === 'accepted')?.supplier?.company_name ||
                    project.project_suppliers.find(ps => ps.status === 'accepted')?.supplier?.username ||
                    project.project_suppliers[0]?.supplier?.company_name ||
                    project.project_suppliers[0]?.supplier?.username ||
                    'Atanmamış'
                  )
                ) : (project.supplier_name || 'Atanmamış')}
              </span>
              {project.deadline && (
                <span className={`meta-item deadline-${getDeadlineStatus(project.deadline)}`}>
                  <Calendar size={16} />
                  Termin: {new Date(project.deadline).toLocaleDateString('tr-TR')}
                  {(() => {
                    const status = getDeadlineStatus(project.deadline)
                    const diffDays = Math.ceil((new Date(project.deadline) - new Date()) / (1000 * 60 * 60 * 24))
                    
                    if (status === 'overdue') return ' (GEÇTİ)'
                    if (status === 'urgent') return ` (${diffDays} gün kaldı)`
                    return ''
                  })()}
                </span>
              )}
              {/* Show accepted quotation price */}
              {project.project_suppliers && project.project_suppliers.length > 0 && (
                (() => {
                  const acceptedSupplier = project.project_suppliers.find(ps => ps.status === 'accepted')
                  if (acceptedSupplier && acceptedSupplier.quoted_price) {
                    return (
                      <span className="meta-item" style={{ color: '#10b981', fontWeight: '600' }}>
                        Fiyat: {acceptedSupplier.quoted_price.toLocaleString('tr-TR')}₺
                      </span>
                    )
                  }
                  return null
                })()
              )}
            </div>
          </div>
        </div>
        
        <div className="header-actions">
          {user.role === 'user' && project.status !== 'completed' && project.can_edit_checklist && (
            <button 
              className="btn btn-primary"
              onClick={handleComplete}
              disabled={completing || hasProblematicFiles}
              title={hasProblematicFiles ? 'Pasif veya önizleme dosyaları var - önce revizyonları tamamlayın' : ''}
            >
              {completing ? 'Tamamlanıyor...' : (
                <>
                  <CheckCircle size={18} />
                  İşi Tamamla
                </>
              )}
            </button>
          )}

          {(user.role === 'customer' || user.role === 'admin') && (
            <button 
              className="btn btn-danger"
              onClick={handleDeleteProject}
              disabled={deletingProject}
            >
              {deletingProject ? 'Siliniyor...' : (
                <>
                  <Trash2 size={18} />
                  Projeyi Sil
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Project Progress Bar */}
      <div className="project-progress-section">
        <div className="progress-info">
          <span>Proje İlerlemesi</span>
          <span className="progress-percentage">{totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0}%</span>
        </div>
        <div className="project-progress-bar">
          <div 
            className="project-progress-fill" 
            style={{ width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="detail-content">
        {/* Left Panel: Files or Viewer */}
        <div className="viewer-panel">
          {viewMode === 'files' && hasProjectFiles ? (
            // Files List View (kategorilere ayrılmış + filtre)
            <>
              <div className="panel-header panel-header-with-filter">
                <h2>Proje Dosyaları</h2>
                <span className="file-count">
                  {fileCategoryFilter === 'pasif'
                    ? inactiveFiles.length
                    : fileCategoryFilter === 'all'
                      ? activeFilesWithPreviews.length
                      : filteredFilesWithPreviews?.length ?? 0}{' '}
                  dosya
                </span>
              </div>
              <div className="file-category-filter">
                <Filter size={16} className="filter-icon" />
                {['all', 'work', 'pdf', 'excel', 'image', 'document', 'other', 'pasif'].map((key) => {
                  const cat = FILE_CATEGORIES[key]
                  const count = key === 'all'
                    ? activeFilesWithPreviews.length
                    : key === 'pasif'
                      ? inactiveFiles.length
                      : (groupedByCategory[key] || []).length
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`file-filter-btn ${fileCategoryFilter === key ? 'active' : ''}`}
                      onClick={() => setFileCategoryFilter(key)}
                    >
                      {cat.label}
                      {count > 0 && <span className="file-filter-count">({count})</span>}
                    </button>
                  )
                })}
              </div>
              <div className="files-list-by-category">
                {fileCategoryFilter === 'all' ? (
                  (['work', 'pdf', 'excel', 'image', 'document', 'other']).map((catKey) => {
                    const list = groupedByCategory[catKey] || []
                    if (list.length === 0) return null
                    const catLabel = FILE_CATEGORIES[catKey].label
                    return (
                      <div key={catKey} className="file-category-section">
                        <div className="panel-header category-section-header">
                          <h3>{catLabel}</h3>
                          <span className="file-count">{list.length} dosya</span>
                        </div>
                        <div className="files-grid">
                          {list.map(({ file, pendingPreviews, isActive }) => (
                            <div key={`file-group-${file.id}`} className={pendingPreviews?.length > 0 ? 'file-group-with-preview' : ''}>
                              <div
                                className={`project-file-card ${!isActive ? 'inactive' : ''}`}
                                data-status={file.status}
                                onClick={() => handleFileClick(file)}
                              >
                                <div className="file-card-icon">{getFileIcon(file.file_type)}</div>
                                <div className="file-card-info">
                                  <span className="file-card-name">{file.file_name}</span>
                                  {file.description && <span className="file-card-desc">{file.description}</span>}
                                  <div className="file-card-meta">
                                    {['step', 'stl', 'dxf', 'iges', 'parasolid'].includes(file.file_type) && file.quantity > 1 && (
                                      <span className="file-card-qty">{file.quantity} adet</span>
                                    )}
                                    {file.revision && <span className="file-card-revision">Rev. {file.revision}</span>}
                                    {!isActive && <span className="file-card-inactive">PASİF</span>}
                                  </div>
                                </div>
                                <div className="file-card-badge">{file.file_type.toUpperCase()}</div>
                                <button className="file-card-view"><Eye size={16} /></button>
                              </div>
                              {pendingPreviews?.length > 0 && (
                                <>
                                  <div className="file-connection-line"><ArrowRight size={20} /></div>
                                  {pendingPreviews.map((pending) => (
                                    <div key={pending.id} className="project-file-card pending" data-status={pending.status} onClick={() => handleFileClick(pending)}>
                                      <div className="file-card-icon">{getFileIcon(pending.file_type)}</div>
                                      <div className="file-card-info">
                                        <span className="file-card-name">{pending.file_name}</span>
                                        {pending.description && <span className="file-card-desc">{pending.description}</span>}
                                        <div className="file-card-meta">
                                          {['step', 'stl', 'dxf', 'iges', 'parasolid'].includes(pending.file_type) && pending.quantity > 1 && (
                                            <span className="file-card-qty">{pending.quantity} adet</span>
                                          )}
                                          {pending.revision && <span className="file-card-revision">Rev. {pending.revision}</span>}
                                          <span className="file-card-pending">ÖNZLEME</span>
                                        </div>
                                      </div>
                                      <div className="file-card-badge">{pending.file_type.toUpperCase()}</div>
                                      <button className="file-card-view"><Eye size={16} /></button>
                                    </div>
                                  ))}
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <>
                    {fileCategoryFilter === 'pasif' && inactiveFiles.length > 0 && (
                      <div className="panel-header category-section-header pasif-section-header">
                        <h3>Pasif dosyalar (eski revizyonlar)</h3>
                        <span className="file-count">{inactiveFiles.length} dosya</span>
                      </div>
                    )}
                    <div className="files-grid">
                    {(filteredFilesWithPreviews || []).map(({ file, pendingPreviews, isActive }) => (
                      <div key={`file-group-${file.id}`} className={pendingPreviews?.length > 0 ? 'file-group-with-preview' : ''}>
                        <div
                          className={`project-file-card ${!isActive ? 'inactive' : ''}`}
                          data-status={file.status}
                          onClick={() => handleFileClick(file)}
                        >
                          <div className="file-card-icon">{getFileIcon(file.file_type)}</div>
                          <div className="file-card-info">
                            <span className="file-card-name">{file.file_name}</span>
                            {file.description && <span className="file-card-desc">{file.description}</span>}
                            <div className="file-card-meta">
                              {['step', 'stl', 'dxf', 'iges', 'parasolid'].includes(file.file_type) && file.quantity > 1 && (
                                <span className="file-card-qty">{file.quantity} adet</span>
                              )}
                              {file.revision && <span className="file-card-revision">Rev. {file.revision}</span>}
                              {!isActive && <span className="file-card-inactive">PASİF</span>}
                            </div>
                          </div>
                          <div className="file-card-badge">{file.file_type.toUpperCase()}</div>
                          <button className="file-card-view"><Eye size={16} /></button>
                        </div>
                        {pendingPreviews?.length > 0 && (
                          <>
                            <div className="file-connection-line"><ArrowRight size={20} /></div>
                            {pendingPreviews.map((pending) => (
                              <div key={pending.id} className="project-file-card pending" data-status={pending.status} onClick={() => handleFileClick(pending)}>
                                <div className="file-card-icon">{getFileIcon(pending.file_type)}</div>
                                <div className="file-card-info">
                                  <span className="file-card-name">{pending.file_name}</span>
                                  {pending.description && <span className="file-card-desc">{pending.description}</span>}
                                  <div className="file-card-meta">
                                    {['step', 'stl', 'dxf', 'iges', 'parasolid'].includes(pending.file_type) && pending.quantity > 1 && (
                                      <span className="file-card-qty">{pending.quantity} adet</span>
                                    )}
                                    {pending.revision && <span className="file-card-revision">Rev. {pending.revision}</span>}
                                    <span className="file-card-pending">ÖNZLEME</span>
                                  </div>
                                </div>
                                <div className="file-card-badge">{pending.file_type.toUpperCase()}</div>
                                <button className="file-card-view"><Eye size={16} /></button>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  </>
                )}
              </div>
            </>
          ) : viewMode === 'viewer' && activeFile ? (
            // Single File Viewer
            <>
              {/* Revision Manager - dosya viewer'ın üstünde */}
              {project.status !== 'completed' && (
                <RevisionManager
                  projectId={project.id}
                  file={activeFile}
                  userRole={user.role}
                  project={project}
                  onRevisionAccepted={async () => {
                    // Wait a bit for backend to complete all operations
                    await new Promise(resolve => setTimeout(resolve, 800))
                    // Refresh project data
                    await fetchProject()
                    // Reset active file to show updated file list
                    setActiveFile(null)
                  }}
                  onRevisionCreated={() => {
                    fetchProject()
                  }}
                />
              )}
              
              <div className="panel-header file-viewer-header">
                <button className="back-to-files" onClick={handleBackToFiles}>
                  <ChevronLeft size={20} />
                  Dosyalara Dön
                </button>
                <span className="file-name-display">
                  {activeFile.file_name}
                  {activeFile.status === 'pending' && (
                    <span className="pending-badge">ÖNZLEME</span>
                  )}
                  {activeFile.is_active === false && activeFile.status !== 'pending' && (
                    <span className="inactive-badge">PASİF</span>
                  )}
                </span>
                {(activeFile.file_url || (project?.id && activeFile?.id)) && activeFile.status !== 'pending' && (
                  <button 
                    className="download-file-btn"
                    title="Dosyayı İndir"
                    onClick={async () => {
                      try {
                        const downloadUrl = (project?.id && activeFile?.id && token)
                          ? `${API_URL}/api/projects/${project.id}/files/${activeFile.id}/stream`
                          : activeFile.file_url
                        const headers = token ? { Authorization: `Bearer ${token}` } : {}
                        const response = await fetch(downloadUrl, { headers })
                        if (!response.ok) throw new Error('İndirilemedi')
                        const blob = await response.blob()
                        const url = window.URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = activeFile.file_name
                        document.body.appendChild(a)
                        a.click()
                        window.URL.revokeObjectURL(url)
                        document.body.removeChild(a)
                      } catch (err) {
                        console.error('Download error:', err)
                        if (activeFile.file_url) window.open(activeFile.file_url, '_blank')
                      }
                    }}
                  >
                    <Download size={18} />
                  </button>
                )}
              </div>
              <div className="viewer-container">
                {renderFilePreview(activeFile, { projectId: project?.id, fileId: activeFile?.id, token })}
              </div>
              {activeFile.notes && (
                <div className="file-notes">
                  <strong>Not:</strong> {activeFile.notes}
                </div>
              )}
            </>
          ) : (
            // Legacy: Single STEP file view
            <>
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
            </>
          )}
        </div>

        <div className="checklist-panel">
          {/* Müşteri için Teklifler Paneli - sadece STEP viewer modunda DEĞİLSE göster */}
          {user.role === 'customer' && project.is_quotation && !(viewMode === 'viewer' && ['step', 'dxf', 'iges', 'parasolid'].includes(activeFile?.file_type)) && (
            <div className="quotations-panel">
              <div className="panel-header">
                <div className="panel-header-left" onClick={() => setQuotationsPanelExpanded(!quotationsPanelExpanded)} style={{ cursor: 'pointer' }}>
                  {quotationsPanelExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  <h2>
                    <Send size={18} />
                    Gelen Teklifler
                  </h2>
                </div>
                <div className="panel-header-right">
                  <span className="quotation-count">
                    {quotations.filter(q => q.status === 'quoted').length} teklif
                  </span>
                  <button 
                    className="btn-view-details" 
                    onClick={() => setShowQuotationDetailsModal(true)}
                    title="Detaylı Görünüm"
                  >
                    Detaylar
                  </button>
                </div>
              </div>

              {quotationsPanelExpanded && (
                <div className="quotations-panel-content">
                {loadingQuotations ? (
                  <div className="loading-quotations">
                    <div className="loading-spinner small"></div>
                    <span>Teklifler yükleniyor...</span>
                  </div>
                ) : quotations.length === 0 ? (
                  <div className="no-quotations">
                    <Clock size={32} />
                    <p>Henüz teklif gelmedi</p>
                    <span>Tedarikçiler tekliflerini gönderdiğinde burada görünecek</span>
                  </div>
                ) : (
                  <div className="quotations-list">
                    {quotations.map(q => (
                      <div key={q.id} className={`quotation-item ${q.status}`}>
                        <div className="quotation-item-header">
                          <div className="supplier-info">
                            <Building2 size={16} />
                            <span className="supplier-name">{q.supplier?.company_name || q.supplier?.username}</span>
                          </div>
                          <span className={`quotation-status-badge ${q.status}`}>
                            {q.status === 'pending' && 'Bekleniyor'}
                            {q.status === 'quoted' && 'Teklif Geldi'}
                            {q.status === 'accepted' && 'Kabul Edildi'}
                            {q.status === 'rejected' && 'Reddedildi'}
                            {q.status === 'expired' && 'Süresi Doldu'}
                          </span>
                        </div>

                        {q.status === 'quoted' && (
                          <>
                            <div className="quotation-details">
                              <div className="quotation-price-row">
                                <div className="quotation-price">
                                  <DollarSign size={18} />
                                  <span className="price-value">₺{Number(q.quoted_price).toLocaleString('tr-TR')}</span>
                                </div>
                                {/* Not Ekle Button - Next to Price */}
                                {editingCustomerNote !== q.supplier?.id && (
                                  <button
                                    className="btn btn-note-add"
                                    onClick={() => handleStartEditCustomerNote(q.supplier?.id, q.customer_note)}
                                  >
                                    <MessageSquare size={14} />
                                    {q.customer_note ? 'Notu Düzenle' : 'Not Ekle'}
                                  </button>
                                )}
                              </div>
                              
                              {q.delivery_date && (
                                <div className="quotation-delivery">
                                  <Calendar size={14} />
                                  <span>Termin: {new Date(q.delivery_date).toLocaleDateString('tr-TR')}</span>
                                </div>
                              )}
                              {q.quoted_note && (
                                <div className="quotation-note">
                                  <MessageSquare size={14} />
                                  <p>{q.quoted_note}</p>
                                </div>
                              )}
                              <span className="quotation-date">
                                Teklif tarihi: {new Date(q.quoted_at).toLocaleDateString('tr-TR')}
                              </span>
                            </div>

                            {/* Customer Note Section - Editing or Display */}
                            {(editingCustomerNote === q.supplier?.id || q.customer_note) && (
                              <div className="customer-note-section">
                                {editingCustomerNote === q.supplier?.id ? (
                                  <div className="note-edit-form">
                                    <textarea
                                      className="note-textarea"
                                      value={customerNoteText}
                                      onChange={(e) => setCustomerNoteText(e.target.value)}
                                      placeholder="Tedarikçiye not ekleyin (örn: Fiyat güncelleme talebi)"
                                      rows={3}
                                      disabled={savingCustomerNote}
                                    />
                                    <div className="note-edit-actions">
                                      <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={handleCancelCustomerNote}
                                        disabled={savingCustomerNote}
                                      >
                                        İptal
                                      </button>
                                      <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => handleSaveCustomerNote(q.supplier?.id)}
                                        disabled={savingCustomerNote || !customerNoteText.trim()}
                                      >
                                        {savingCustomerNote ? 'Kaydediliyor...' : 'Kaydet'}
                                      </button>
                                    </div>
                                  </div>
                                ) : q.customer_note && (
                                  <div className="customer-note-display">
                                    <div className="note-header">
                                      <MessageSquare size={14} />
                                      <span className="note-label">Notunuz:</span>
                                    </div>
                                    <p className="note-text">{q.customer_note}</p>
                                    {q.customer_note_at && (
                                      <span className="note-date">
                                        {new Date(q.customer_note_at).toLocaleDateString('tr-TR')} {new Date(q.customer_note_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="quotation-actions">
                              <button 
                                className="btn btn-accept"
                                onClick={() => handleAcceptQuotation(q.supplier?.id)}
                                disabled={processingQuotation === q.supplier?.id}
                              >
                                <CheckCheck size={16} />
                                {processingQuotation === q.supplier?.id ? 'İşleniyor...' : 'Kabul Et'}
                              </button>
                              <button 
                                className="btn btn-reject"
                                onClick={() => handleRejectQuotation(q.supplier?.id)}
                                disabled={processingQuotation === q.supplier?.id}
                              >
                                <XCircle size={16} />
                                Reddet
                              </button>
                            </div>
                          </>
                        )}

                        {q.status === 'pending' && (
                          <div className="waiting-quote">
                            <Clock size={16} />
                            <span>
                              {formatQuoteTimeLeft(q.quote_due_at)?.text || 'Teklif bekleniyor...'}
                            </span>
                          </div>
                        )}

                        {q.status === 'expired' && (
                          <div className="waiting-quote expired">
                            <Clock size={16} />
                            <span>Süresi doldu. Teklif gönderilmedi.</span>
                            <button
                              type="button"
                              className="btn btn-extend-deadline"
                              onClick={() => handleExtendDeadline(q.supplier?.id)}
                              disabled={processingQuotation === q.supplier?.id}
                            >
                              {processingQuotation === q.supplier?.id ? 'İşleniyor...' : '+ 1 Gün Uzat'}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}

              {/* Checklist Preview for Customer - Always visible */}
              <div className="checklist-preview">
                <div className="preview-header">
                  <h3>
                    <CheckSquare size={16} />
                    Proje Kontrol Listesi
                  </h3>
                  <span className="preview-count">{checkedCount} / {totalCount}</span>
                </div>
                <div className="preview-items">
                  {project.checklist.map((item, index) => (
                    <div key={item.id} className={`preview-item ${item.is_checked ? 'checked' : ''}`}>
                      <span className="preview-number">{index + 1}.</span>
                      <span className="preview-title">{item.title}</span>
                      {item.is_checked && <Check size={14} className="preview-check" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP File Checklist - görüntülenen STEP dosyası için */}
          {viewMode === 'viewer' && ['step', 'dxf', 'iges', 'parasolid'].includes(activeFile?.file_type) && project.file_checklists?.[activeFile.id] && (
            <div className="file-checklist-section">
              <div className="panel-header">
                <h2>
                  <Box size={18} />
                  Dosya Kontrolü
                  {activeFile.status === 'pending' && (
                    <span className="pending-warning"> (ÖNZLEME - Sadece Görüntüleme)</span>
                  )}
                  {activeFile.is_active === false && activeFile.status !== 'pending' && (
                    <span className="inactive-warning"> (PASİF - Sadece Görüntüleme)</span>
                  )}
                </h2>
                <span className="progress-text">
                  {project.file_checklists[activeFile.id].filter(i => !i.parent_id && i.is_checked).length} / {project.file_checklists[activeFile.id].filter(i => !i.parent_id).length}
                </span>
              </div>
              <div className="file-checklist-items">
                {project.file_checklists[activeFile.id].map((item) => (
                  <div key={item.id}>
                    {/* Parent item (ana başlık) */}
                    <div className={`checklist-item-card ${item.is_checked ? 'is-checked' : ''} ${item.children?.length > 0 ? 'has-children' : ''}`}>
                      <div className="checklist-item-main">
                        {/* Expand/Collapse toggle for items with children */}
                        {item.children?.length > 0 && (
                          <button 
                            className="expand-toggle"
                            onClick={() => toggleExpanded(item.id)}
                          >
                            {expandedItems[item.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        )}
                        
                        <label className="checkbox-wrapper">
                          <input
                            type="checkbox"
                            checked={!!item.is_checked}
                            onChange={(e) => handleChecklistChange(item.id, e.target.checked)}
                            disabled={
                              activeFile.status === 'pending' || 
                              activeFile.is_active === false || 
                              project.status === 'completed' || 
                              user.role === 'customer' || 
                              (user.role === 'user' && !project.can_edit_checklist) || 
                              (item.children?.length > 0)
                            }
                          />
                          <span className="checkbox-custom">
                            <Check size={14} />
                          </span>
                          <span className="checkbox-label">
                            {item.title}
                            {item.children?.length > 0 && (
                              <span className="children-count">
                                ({item.children.filter(c => c.is_checked).length}/{item.children.length})
                              </span>
                            )}
                          </span>
                        </label>
                      </div>

                      {/* Children items (alt başlıklar) */}
                      {item.children?.length > 0 && expandedItems[item.id] && (
                        <div className="checklist-children">
                          {item.children.map((child) => (
                            <div key={child.id} className={`checklist-child-item ${child.is_checked ? 'is-checked' : ''}`}>
                              <label className="checkbox-wrapper">
                                <input
                                  type="checkbox"
                                  checked={!!child.is_checked}
                                  onChange={(e) => handleChecklistChange(child.id, e.target.checked, true, item.id)}
                                  disabled={
                                    activeFile.status === 'pending' || 
                                    activeFile.is_active === false || 
                                    project.status === 'completed' || 
                                    user.role === 'customer' || 
                                    (user.role === 'user' && !project.can_edit_checklist)
                                  }
                                />
                                <span className="checkbox-custom">
                                  <Check size={12} />
                                </span>
                                <span className="checkbox-label">
                                  {child.title}
                                </span>
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Normal Checklist (Teklif kabul edildikten sonra veya admin/user için) */}
          {!(user.role === 'customer' && project.is_quotation) && !(viewMode === 'viewer' && ['step', 'dxf', 'iges', 'parasolid'].includes(activeFile?.file_type)) && (
            <>
              <div className="panel-header">
                <h2>Proje Kontrol Listesi</h2>
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
                  <div key={item.id} className={`checklist-item-card ${item.is_checked ? 'is-checked' : ''} ${item.children?.length > 0 ? 'has-children' : ''}`}>
                    <div className="checklist-item-main">
                      {/* Expand/Collapse toggle for items with children */}
                      {item.children?.length > 0 && (
                        <button 
                          className="expand-toggle"
                          onClick={() => toggleExpanded(item.id)}
                        >
                          {expandedItems[item.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      )}
                      
                      <label className="checkbox-wrapper">
                        <input
                          type="checkbox"
                          checked={!!item.is_checked}
                          onChange={(e) => handleChecklistChange(item.id, e.target.checked)}
                          disabled={
                            project.status === 'completed' || 
                            user.role === 'admin' || 
                            user.role === 'customer' || 
                            !project.can_edit_checklist || 
                            (item.children?.length > 0) ||
                            (viewMode === 'viewer' && activeFile && (activeFile.is_active === false || activeFile.status === 'pending'))
                          }
                        />
                        <span className="checkbox-custom">
                          <Check size={14} />
                        </span>
                        <span className="checkbox-label">
                          <span className="item-number">{index + 1}.</span>
                          {item.title}
                          {item.children?.length > 0 && (
                            <span className="children-count">
                              ({item.children.filter(c => c.is_checked).length}/{item.children.length})
                            </span>
                          )}
                        </span>
                        {item.is_checked && (user.role === 'admin' || user.role === 'customer') && (
                          <span className="checked-indicator">✓ Tamamlandı</span>
                        )}
                      </label>

                      {/* Add sub-item button (for admin/customer) */}
                      {(user.role === 'admin' || user.role === 'customer') && project.status !== 'completed' && (
                        <button 
                          className="add-sub-btn"
                          onClick={() => {
                            setAddingSubItem(item.id)
                            setNewSubItemTitle('')
                            setExpandedItems(prev => ({ ...prev, [item.id]: true }))
                          }}
                          title="Alt madde ekle"
                        >
                          <Plus size={14} />
                        </button>
                      )}
                    </div>

                    {/* Children items */}
                    {item.children?.length > 0 && expandedItems[item.id] && (
                      <div className="checklist-children">
                        {item.children.map((child, childIndex) => (
                          <div key={child.id} className={`checklist-child-item ${child.is_checked ? 'is-checked' : ''}`}>
                            <label className="checkbox-wrapper">
                              <input
                                type="checkbox"
                                checked={!!child.is_checked}
                                onChange={(e) => handleChecklistChange(child.id, e.target.checked, true, item.id)}
                                disabled={
                                  project.status === 'completed' || 
                                  user.role === 'admin' || 
                                  user.role === 'customer' || 
                                  !project.can_edit_checklist ||
                                  (viewMode === 'viewer' && activeFile && (activeFile.is_active === false || activeFile.status === 'pending'))
                                }
                              />
                              <span className="checkbox-custom">
                                <Check size={12} />
                              </span>
                              <span className="checkbox-label">
                                {child.title}
                              </span>
                            </label>

                            {/* Child supplier notes */}
                            {child.supplier_notes && (
                              <div className="supplier-note-display small">
                                <MessageSquare size={12} />
                                <span>{child.supplier_notes}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add sub-item form */}
                    {addingSubItem === item.id && (
                      <div className="add-sub-item-form">
                        <input
                          type="text"
                          value={newSubItemTitle}
                          onChange={(e) => setNewSubItemTitle(e.target.value)}
                          placeholder="Alt madde başlığı..."
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddSubItem(item.id)
                            if (e.key === 'Escape') {
                              setAddingSubItem(null)
                              setNewSubItemTitle('')
                            }
                          }}
                        />
                        <div className="sub-item-actions">
                          <button 
                            className="btn btn-sm btn-cancel"
                            onClick={() => {
                              setAddingSubItem(null)
                              setNewSubItemTitle('')
                            }}
                          >
                            İptal
                          </button>
                          <button 
                            className="btn btn-sm btn-save"
                            onClick={() => handleAddSubItem(item.id)}
                            disabled={savingSubItem || !newSubItemTitle.trim()}
                          >
                            {savingSubItem ? 'Ekleniyor...' : 'Ekle'}
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Tedarikçi notu gösterimi (herkes görebilir) - only for parent items */}
                    {item.supplier_notes && editingNoteId !== item.id && (
                      <div className="supplier-note-display">
                        <div className="note-header">
                          <MessageSquare size={14} />
                          <span className="note-label">Tedarikçi Notu</span>
                          {item.supplier_notes_at && (
                            <span className="note-date">
                              {new Date(item.supplier_notes_at).toLocaleDateString('tr-TR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          )}
                        </div>
                        <p className="note-text">{item.supplier_notes}</p>
                        {user.role === 'user' && project.status !== 'completed' && project.can_edit_checklist && 
                         !(viewMode === 'viewer' && activeFile && (activeFile.is_active === false || activeFile.status === 'pending')) && (
                          <button 
                            className="edit-note-btn"
                            onClick={() => startEditingNote(item)}
                          >
                            Düzenle
                          </button>
                        )}
                      </div>
                    )}

                    {/* Tedarikçi not ekleme/düzenleme */}
                    {user.role === 'user' && project.status !== 'completed' && project.can_edit_checklist && 
                     !(viewMode === 'viewer' && activeFile && (activeFile.is_active === false || activeFile.status === 'pending')) && (
                      <>
                        {editingNoteId === item.id ? (
                          <div className="supplier-note-input">
                            <textarea
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                              placeholder="Not ekleyin (örn: tolerans sorunu, malzeme problemi...)"
                              rows={2}
                              autoFocus
                            />
                            <div className="note-actions">
                              <button 
                                className="btn btn-sm btn-cancel"
                                onClick={cancelEditingNote}
                                disabled={savingNote}
                              >
                                İptal
                              </button>
                              <button 
                                className="btn btn-sm btn-save"
                                onClick={() => handleSaveNote(item.id)}
                                disabled={savingNote}
                              >
                                {savingNote ? 'Kaydediliyor...' : (
                                  <>
                                    <Send size={14} />
                                    Kaydet
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        ) : !item.supplier_notes && (
                          <button 
                            className="add-note-btn"
                            onClick={() => startEditingNote(item)}
                          >
                            <MessageSquare size={14} />
                            Not Ekle
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>

              {user.role === 'user' && project.status !== 'completed' && project.can_edit_checklist && (
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
                        {user.role === 'user' && project.status !== 'completed' && project.can_edit_checklist && (
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
            </>
          )}
        </div>
      </div>

      {/* Quotation Comparison Table Modal */}
      {showQuotationDetailsModal && (() => {
        const quotedSuppliers = quotations.filter(q => q.status === 'quoted')
        
        // Get all unique file items across all quotations
        const allFileItems = []
        const allExtraItems = new Set()
        
        quotedSuppliers.forEach(q => {
          const items = q.quotation?.[0]?.quotation_items || []
          items.forEach(item => {
            if (item.item_type === 'file' && item.file_id) {
              if (!allFileItems.find(f => f.file_id === item.file_id)) {
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
        
        // Also add files from project that might not have quotations yet
        const cadFileTypes = ['step', 'dxf', 'iges', 'parasolid']
        project.project_files?.filter(f => cadFileTypes.includes(f.file_type) && f.is_active).forEach(file => {
          if (!allFileItems.find(f => f.file_id === file.id)) {
            allFileItems.push({
              file_id: file.id,
              file_name: file.file_name,
              revision: file.revision,
              quantity: file.quantity
            })
          }
        })

        return (
          <div className="modal-overlay" onClick={() => setShowQuotationDetailsModal(false)}>
            <div className="modal-content quotation-comparison-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>
                  <DollarSign size={20} />
                  Teklif Karşılaştırma Tablosu
                </h2>
                <button className="modal-close" onClick={() => setShowQuotationDetailsModal(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">
                {quotedSuppliers.length === 0 ? (
                  <div className="no-quotations-modal">
                    <Clock size={32} />
                    <p>Henüz teklif gelmedi</p>
                  </div>
                ) : (
                  <div className="comparison-table-wrapper comparison-table-transposed">
                    <table className="comparison-table">
                      <colgroup>
                        <col style={{ width: '200px' }} />
                        {quotedSuppliers.map((_, i) => (
                          <col key={i} style={{ width: '160px' }} />
                        ))}
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="sticky-col label-col">Kalem</th>
                          {quotedSuppliers.map((quotation) => (
                            <th key={quotation.id} className="supplier-col">
                              <div className="supplier-info-cell">
                                <span className="supplier-name">{quotation.supplier?.username}</span>
                                {quotation.supplier?.company_name && (
                                  <span className="supplier-company">{quotation.supplier.company_name}</span>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="sticky-col label-cell">Termin</td>
                          {quotedSuppliers.map((quotation) => (
                            <td key={quotation.id} className="delivery-cell">
                              {quotation.delivery_date
                                ? new Date(quotation.delivery_date).toLocaleDateString('tr-TR')
                                : '-'}
                            </td>
                          ))}
                        </tr>
                        {allFileItems.map((file, idx) => {
                          const label = (
                            <>
                              <Box size={12} />
                              <span className="part-name" title={file.file_name}>
                                {file.file_name.length > 20 ? file.file_name.substring(0, 17) + '...' : file.file_name}
                              </span>
                              {file.revision && <span className="part-rev">Rev.{file.revision}</span>}
                              <span className="part-qty">x{file.quantity || 1}</span>
                            </>
                          )
                          return (
                            <tr key={idx}>
                              <td className="sticky-col label-cell part-label">
                                <div className="part-header">{label}</div>
                              </td>
                              {quotedSuppliers.map((quotation) => {
                                const items = quotation.quotation?.[0]?.quotation_items || []
                                const itemsMap = {}
                                items.forEach(item => {
                                  if (item.item_type === 'file' && item.file_id) itemsMap[item.file_id] = item
                                })
                                const item = itemsMap[file.file_id]
                                return (
                                  <td key={quotation.id} className="price-cell">
                                    {item ? (
                                      <div className="price-info">
                                        <span className="unit-price">₺{Number(item.price).toFixed(0)}</span>
                                        <span className="total-item-price">
                                          = ₺{(Number(item.price) * Number(item.quantity)).toLocaleString('tr-TR')}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="no-price">-</span>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                        {/* Tek satır: Ek İş — tedarikçinin tüm ek işlerinin toplamı */}
                        <tr>
                          <td className="sticky-col label-cell extra-label">
                            <div className="part-header extra">
                              <Plus size={12} />
                              <span className="part-name">Ek İş</span>
                            </div>
                          </td>
                          {quotedSuppliers.map((quotation) => {
                            const items = quotation.quotation?.[0]?.quotation_items || []
                            const extraTotal = items
                              .filter(item => item.item_type === 'extra')
                              .reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity || 1)), 0)
                            return (
                              <td key={quotation.id} className="price-cell extra-cell">
                                {extraTotal > 0 ? (
                                  <span className="extra-price">₺{extraTotal.toLocaleString('tr-TR')}</span>
                                ) : (
                                  <span className="no-price">-</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                        <tr>
                          <td className="sticky-col label-cell">Toplam</td>
                          {quotedSuppliers.map((quotation) => {
                            const totalPrice = Number(quotation.quotation?.[0]?.total_price || quotation.quoted_price || 0)
                            return (
                              <td key={quotation.id} className="total-cell">
                                <span className="total-price">₺{totalPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                              </td>
                            )
                          })}
                        </tr>
                        <tr>
                          <td className="sticky-col label-cell">İşlem</td>
                          {quotedSuppliers.map((quotation) => (
                            <td key={quotation.id} className="actions-cell">
                              <div className="action-buttons">
                                <button
                                  className="btn-mini btn-accept-mini"
                                  onClick={() => {
                                    setShowQuotationDetailsModal(false)
                                    handleAcceptQuotation(quotation.supplier?.id)
                                  }}
                                  disabled={processingQuotation === quotation.supplier?.id}
                                  title="Kabul Et"
                                >
                                  <CheckCheck size={14} />
                                </button>
                                <button
                                  className="btn-mini btn-reject-mini"
                                  onClick={() => {
                                    setShowQuotationDetailsModal(false)
                                    handleRejectQuotation(quotation.supplier?.id)
                                  }}
                                  disabled={processingQuotation === quotation.supplier?.id}
                                  title="Reddet"
                                >
                                  <XCircle size={14} />
                                </button>
                              </div>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}






