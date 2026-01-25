import express from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import { supabaseAdmin } from '../db/supabase.js'
import { authenticateToken } from '../middleware/supabaseAuth.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Configure multer for temporary file storage
const storage = multer.memoryStorage()

const stepFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase()
  if (ext === '.step' || ext === '.stp') {
    cb(null, true)
  } else {
    cb(new Error('Sadece STEP (.step, .stp) dosyaları yüklenebilir.'), false)
  }
}

const documentFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase()
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx']
  if (allowed.includes(ext)) {
    cb(null, true)
  } else {
    cb(new Error('Sadece PDF, JPG, PNG, DOC, DOCX dosyaları yüklenebilir.'), false)
  }
}

// Project files filter - STEP, PDF, Excel, images
const projectFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase()
  const allowed = ['.step', '.stp', '.pdf', '.xlsx', '.xls', '.jpg', '.jpeg', '.png', '.doc', '.docx']
  if (allowed.includes(ext)) {
    cb(null, true)
  } else {
    cb(new Error('Desteklenmeyen dosya formatı.'), false)
  }
}

const uploadStep = multer({ storage, fileFilter: stepFilter, limits: { fileSize: 100 * 1024 * 1024 } })
const uploadDocument = multer({ storage, fileFilter: documentFilter, limits: { fileSize: 20 * 1024 * 1024 } })
const uploadProjectFiles = multer({ storage, fileFilter: projectFileFilter, limits: { fileSize: 100 * 1024 * 1024 } })

// Upload STEP file to Supabase Storage (admin & customer)
router.post('/step/:projectId', authenticateToken, uploadStep.single('file'), async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'customer') {
      return res.status(403).json({ error: 'Sadece admin ve müşteriler STEP dosyası yükleyebilir.' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenmedi.' })
    }

    const fileName = `${req.params.projectId}/${uuidv4()}${path.extname(req.file.originalname)}`

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from('step-files')
      .upload(fileName, req.file.buffer, {
        contentType: 'application/octet-stream',
        upsert: false
      })

    if (error) {
      console.error('Storage upload error:', error)
      throw error
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('step-files')
      .getPublicUrl(fileName)

    // For private buckets, use signed URL instead
    const { data: signedUrlData } = await supabaseAdmin.storage
      .from('step-files')
      .createSignedUrl(fileName, 60 * 60 * 24 * 365) // 1 year

    const filePath = signedUrlData?.signedUrl || urlData?.publicUrl || `/storage/step-files/${fileName}`

    // Update project
    await supabaseAdmin
      .from('projects')
      .update({
        step_file_path: filePath,
        step_file_name: req.file.originalname
      })
      .eq('id', req.params.projectId)

    res.json({
      message: 'STEP dosyası başarıyla yüklendi.',
      file_path: filePath,
      file_name: req.file.originalname
    })
  } catch (error) {
    console.error('Upload STEP error:', error)
    res.status(500).json({ error: 'Dosya yükleme hatası.' })
  }
})

// Upload document to Supabase Storage (user)
router.post('/document/:projectId', authenticateToken, uploadDocument.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenmedi.' })
    }

    const { checklist_item_id } = req.body
    const fileName = `${req.params.projectId}/${uuidv4()}${path.extname(req.file.originalname)}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('documents')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      })

    if (uploadError) throw uploadError

    // Get signed URL
    const { data: signedUrlData } = await supabaseAdmin.storage
      .from('documents')
      .createSignedUrl(fileName, 60 * 60 * 24 * 365) // 1 year

    const filePath = signedUrlData?.signedUrl || `/storage/documents/${fileName}`

    // Save document record
    const { data, error } = await supabaseAdmin
      .from('documents')
      .insert({
        project_id: req.params.projectId,
        checklist_item_id: checklist_item_id || null,
        file_path: filePath,
        file_name: req.file.originalname,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        uploaded_by: req.user.id
      })
      .select()
      .single()

    if (error) throw error

    res.json({
      id: data.id,
      message: 'Dosya başarıyla yüklendi.',
      file_path: filePath,
      file_name: req.file.originalname
    })
  } catch (error) {
    console.error('Upload document error:', error)
    res.status(500).json({ error: 'Dosya yükleme hatası.' })
  }
})

// Upload multiple project files (for new project wizard)
router.post('/project-files', authenticateToken, uploadProjectFiles.array('files', 20), async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'customer') {
      return res.status(403).json({ error: 'Sadece admin ve müşteriler dosya yükleyebilir.' })
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Dosya yüklenmedi.' })
    }

    const tempId = uuidv4() // Temporary folder until project is created
    const uploadedFiles = []

    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase()
      const fileName = `temp/${tempId}/${uuidv4()}${ext}`
      
      // Determine file type
      let fileType = 'other'
      if (['.step', '.stp'].includes(ext)) fileType = 'step'
      else if (ext === '.pdf') fileType = 'pdf'
      else if (['.xlsx', '.xls'].includes(ext)) fileType = 'excel'
      else if (['.jpg', '.jpeg', '.png'].includes(ext)) fileType = 'image'

      // Upload to Supabase Storage
      const { error: uploadError } = await supabaseAdmin.storage
        .from('project-files')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        continue
      }

      // Get signed URL
      const { data: signedUrlData } = await supabaseAdmin.storage
        .from('project-files')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365) // 1 year

      uploadedFiles.push({
        temp_path: fileName,
        file_url: signedUrlData?.signedUrl,
        file_name: file.originalname,
        file_type: fileType,
        file_size: file.size,
        mime_type: file.mimetype
      })
    }

    res.json({
      message: `${uploadedFiles.length} dosya yüklendi.`,
      temp_folder: tempId,
      files: uploadedFiles
    })
  } catch (error) {
    console.error('Upload project files error:', error)
    res.status(500).json({ error: 'Dosya yükleme hatası.' })
  }
})

// General file upload for revisions (accepts any project file type)
router.post('/', authenticateToken, uploadProjectFiles.single('file'), async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'customer') {
      return res.status(403).json({ error: 'Sadece admin ve müşteriler dosya yükleyebilir.' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenmedi.' })
    }

    console.log('General upload:', { 
      fileName: req.file.originalname, 
      size: req.file.size,
      userId: req.user.id 
    })

    const tempId = uuidv4()
    const ext = path.extname(req.file.originalname).toLowerCase()
    const fileName = `revisions/${tempId}/${uuidv4()}${ext}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('project-files')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      throw uploadError
    }

    // Get signed URL
    const { data: signedUrlData } = await supabaseAdmin.storage
      .from('project-files')
      .createSignedUrl(fileName, 60 * 60 * 24 * 365) // 1 year

    const fileUrl = signedUrlData?.signedUrl

    if (!fileUrl) {
      throw new Error('Dosya URL\'si alınamadı')
    }

    console.log('Upload successful:', { fileName, fileUrl: fileUrl.substring(0, 50) + '...' })

    res.json({
      message: 'Dosya başarıyla yüklendi.',
      url: fileUrl,
      path: fileName,
      file_name: req.file.originalname
    })
  } catch (error) {
    console.error('General upload error:', error)
    res.status(500).json({ error: error.message || 'Dosya yükleme hatası.' })
  }
})

// Error handler for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Dosya boyutu çok büyük.' })
    }
    return res.status(400).json({ error: error.message })
  }
  if (error) {
    return res.status(400).json({ error: error.message })
  }
  next()
})

export default router
