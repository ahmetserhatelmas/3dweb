import express from 'express'
import { supabaseAdmin } from '../db/supabase.js'
import { authenticateToken, requireAdmin } from '../middleware/supabaseAuth.js'

const router = express.Router()

// Get all projects (admin sees all, user sees only assigned)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('projects')
      .select(`
        *,
        supplier:profiles!projects_assigned_to_fkey(id, username, company_name),
        creator:profiles!projects_created_by_fkey(username)
      `)
      .order('created_at', { ascending: false })

    // If not admin, filter by assigned_to
    if (req.user.role !== 'admin') {
      query = query.eq('assigned_to', req.user.id)
    }

    const { data: projects, error } = await query

    if (error) throw error

    // Get checklist counts for each project
    const projectsWithCounts = await Promise.all(
      projects.map(async (project) => {
        const { count: totalItems } = await supabaseAdmin
          .from('checklist_items')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', project.id)

        const { count: checkedItems } = await supabaseAdmin
          .from('checklist_items')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', project.id)
          .eq('is_checked', true)

        return {
          ...project,
          supplier_name: project.supplier?.company_name,
          supplier_username: project.supplier?.username,
          total_items: totalItems || 0,
          checked_items: checkedItems || 0
        }
      })
    )

    res.json(projectsWithCounts)
  } catch (error) {
    console.error('Get projects error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Get single project with checklist
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .select(`
        *,
        supplier:profiles!projects_assigned_to_fkey(id, username, company_name),
        creator:profiles!projects_created_by_fkey(username)
      `)
      .eq('id', req.params.id)
      .single()

    if (error || !project) {
      return res.status(404).json({ error: 'Proje bulunamadı.' })
    }

    // Check access
    if (req.user.role !== 'admin' && project.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Bu projeye erişim yetkiniz yok.' })
    }

    // Update status to reviewing if user opens it
    if (req.user.role === 'user' && project.status === 'pending') {
      await supabaseAdmin
        .from('projects')
        .update({ status: 'reviewing' })
        .eq('id', req.params.id)
      project.status = 'reviewing'
    }

    // Get checklist items
    const { data: checklist } = await supabaseAdmin
      .from('checklist_items')
      .select('*')
      .eq('project_id', req.params.id)
      .order('created_at')

    // Get documents
    const { data: documents } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('project_id', req.params.id)
      .order('uploaded_at', { ascending: false })

    res.json({
      ...project,
      supplier_name: project.supplier?.company_name,
      supplier_username: project.supplier?.username,
      creator_username: project.creator?.username,
      checklist: checklist || [],
      documents: documents || []
    })
  } catch (error) {
    console.error('Get project error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Create new project (admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, part_number, assigned_to, deadline, checklist } = req.body

    if (!name || !part_number || !assigned_to) {
      return res.status(400).json({ error: 'Proje adı, parça numarası ve atanan tedarikçi gerekli.' })
    }

    // Create project
    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .insert({
        name,
        part_number,
        assigned_to,
        created_by: req.user.id,
        deadline: deadline || null
      })
      .select()
      .single()

    if (error) throw error

    // Add checklist items
    if (checklist && checklist.length > 0) {
      const checklistItems = checklist
        .filter(item => item.trim() !== '')
        .map(title => ({
          project_id: project.id,
          title
        }))

      if (checklistItems.length > 0) {
        await supabaseAdmin.from('checklist_items').insert(checklistItems)
      }
    }

    res.status(201).json({ id: project.id, message: 'Proje başarıyla oluşturuldu.' })
  } catch (error) {
    console.error('Create project error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Update project STEP file (admin only)
router.patch('/:id/step-file', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { step_file_path, step_file_name } = req.body

    const { error } = await supabaseAdmin
      .from('projects')
      .update({ step_file_path, step_file_name })
      .eq('id', req.params.id)

    if (error) throw error

    res.json({ message: 'STEP dosyası güncellendi.' })
  } catch (error) {
    console.error('Update STEP file error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Update checklist item
router.patch('/:projectId/checklist/:itemId', authenticateToken, async (req, res) => {
  try {
    const { is_checked } = req.body
    const { projectId, itemId } = req.params

    // Verify project access
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('assigned_to')
      .eq('id', projectId)
      .single()

    if (!project) {
      return res.status(404).json({ error: 'Proje bulunamadı.' })
    }

    if (req.user.role !== 'admin' && project.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Bu projeye erişim yetkiniz yok.' })
    }

    // Update checklist item
    const { error } = await supabaseAdmin
      .from('checklist_items')
      .update({
        is_checked,
        checked_at: is_checked ? new Date().toISOString() : null
      })
      .eq('id', itemId)
      .eq('project_id', projectId)

    if (error) throw error

    // Check if all items are checked
    const { count: total } = await supabaseAdmin
      .from('checklist_items')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)

    const { count: checked } = await supabaseAdmin
      .from('checklist_items')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('is_checked', true)

    res.json({
      message: 'Checklist güncellendi.',
      all_checked: total === checked
    })
  } catch (error) {
    console.error('Update checklist error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Complete project (user)
router.post('/:id/complete', authenticateToken, async (req, res) => {
  try {
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('assigned_to, status')
      .eq('id', req.params.id)
      .single()

    if (!project) {
      return res.status(404).json({ error: 'Proje bulunamadı.' })
    }

    if (req.user.role !== 'admin' && project.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Bu projeye erişim yetkiniz yok.' })
    }

    // Check all items are checked
    const { count: total } = await supabaseAdmin
      .from('checklist_items')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', req.params.id)

    const { count: checked } = await supabaseAdmin
      .from('checklist_items')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', req.params.id)
      .eq('is_checked', true)

    if (total !== checked) {
      return res.status(400).json({ error: 'Tüm checklist maddeleri işaretlenmeden iş tamamlanamaz.' })
    }

    await supabaseAdmin
      .from('projects')
      .update({ status: 'completed' })
      .eq('id', req.params.id)

    res.json({ message: 'İş başarıyla tamamlandı.' })
  } catch (error) {
    console.error('Complete project error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Add checklist item (admin only)
router.post('/:id/checklist', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { title } = req.body

    if (!title) {
      return res.status(400).json({ error: 'Checklist maddesi başlığı gerekli.' })
    }

    const { data, error } = await supabaseAdmin
      .from('checklist_items')
      .insert({ project_id: req.params.id, title })
      .select()
      .single()

    if (error) throw error

    res.status(201).json({ id: data.id, message: 'Checklist maddesi eklendi.' })
  } catch (error) {
    console.error('Add checklist item error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Delete checklist item (admin only)
router.delete('/:projectId/checklist/:itemId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('checklist_items')
      .delete()
      .eq('id', req.params.itemId)
      .eq('project_id', req.params.projectId)

    if (error) throw error

    res.json({ message: 'Checklist maddesi silindi.' })
  } catch (error) {
    console.error('Delete checklist item error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

export default router
