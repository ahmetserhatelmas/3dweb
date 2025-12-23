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

const uploadStep = multer({ storage, fileFilter: stepFilter, limits: { fileSize: 100 * 1024 * 1024 } })
const uploadDocument = multer({ storage, fileFilter: documentFilter, limits: { fileSize: 20 * 1024 * 1024 } })

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
