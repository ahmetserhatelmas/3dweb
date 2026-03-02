import express from 'express'
import { Readable } from 'stream'
import { spawn } from 'child_process'
import { supabaseAdmin } from '../db/supabase.js'
import { authenticateToken, requireAdmin, requireAdminOrCustomer } from '../middleware/supabaseAuth.js'
import { sendContractEmailToSupplier, sendQuoteRequestToSupplier, sendQuoteReminder1DayLeft } from '../lib/email.js'
import { getR2ObjectStream } from '../lib/r2Storage.js'

const router = express.Router()

// R2 key prefix check (project files stored in R2)
function isR2Key(path) {
  return path && typeof path === 'string' && (path.startsWith('temp/') || path.startsWith('projects/') || path.startsWith('revisions/'))
}

// Get all projects (admin sees all, customer sees their created projects, user sees only assigned/accepted)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Create FRESH Supabase client for this request
    const { createClient } = await import('@supabase/supabase-js')
    const freshClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    let projects = []

    if (req.user.role === 'admin') {
      // Admin sees all projects - OPTIMIZED
      const { data, error } = await freshClient
        .from('projects')
        .select(`
          *,
          supplier:profiles!projects_assigned_to_fkey(id, username, company_name),
          creator:profiles!projects_created_by_fkey(username),
          project_suppliers(
            id,
            status,
            quoted_price,
            supplier:profiles(id, username, company_name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100) // Safety limit
    
      if (error) throw error
      projects = data || []
    } else if (req.user.role === 'customer') {
      // Customer sees projects they created OR projects created by their customer admin
      let creatorIds = [req.user.id]
      
      // If user is a customer user (has customer_id), get projects from their admin
      if (req.user.customer_id) {
        creatorIds = [req.user.customer_id]
      }
      
      // If user is customer admin (is_customer_admin), also get projects from their users
      if (req.user.is_customer_admin) {
        const { data: customerUsers } = await freshClient
          .from('customer_users')
          .select('user_id')
          .eq('customer_id', req.user.id)
          .eq('status', 'active')
        
        if (customerUsers && customerUsers.length > 0) {
          creatorIds.push(...customerUsers.map(cu => cu.user_id))
        }
      }
      
      const { data, error } = await freshClient
        .from('projects')
        .select(`
          *,
          supplier:profiles!projects_assigned_to_fkey(id, username, company_name),
          creator:profiles!projects_created_by_fkey(username),
          project_suppliers(
            id,
            status,
            quoted_price,
            supplier:profiles(id, username, company_name)
          )
        `)
        .in('created_by', creatorIds)
        .order('created_at', { ascending: false })
        .limit(100) // Safety limit
      
      if (error) throw error
      projects = data || []
    } else if (req.user.role === 'user') {
      // User sees only projects where they are ACCEPTED supplier
      const { data: supplierProjects, error } = await freshClient
        .from('project_suppliers')
        .select(`
          id,
          status,
          quoted_price,
          project:projects(
            *,
            supplier:profiles!projects_assigned_to_fkey(id, username, company_name),
            creator:profiles!projects_created_by_fkey(username)
          )
        `)
        .eq('supplier_id', req.user.id)
        .eq('status', 'accepted')
      
      if (error) throw error
      
      // Map projects with quoted_price
      projects = supplierProjects?.map(sp => ({
        ...sp.project,
        accepted_quoted_price: sp.quoted_price
      })).filter(Boolean) || []
    }

    // OPTIMIZED: Skip checklist counts for dashboard - too slow, not needed
    // Checklist counts will be loaded on project detail page only
    const projectsWithCounts = projects.map((project) => {
      // Get accepted_quoted_price from project_suppliers
      let accepted_quoted_price = null
      if (project.project_suppliers && Array.isArray(project.project_suppliers)) {
        const acceptedSupplier = project.project_suppliers.find(ps => ps.status === 'accepted')
        if (acceptedSupplier && acceptedSupplier.quoted_price) {
          accepted_quoted_price = acceptedSupplier.quoted_price
        }
      }
      
      return {
        ...project,
        supplier_name: project.supplier?.company_name,
        supplier_username: project.supplier?.username,
        creator_username: project.creator?.username,
        total_items: 0, // Will be loaded on detail page
        checked_items: 0, // Will be loaded on detail page
        accepted_quoted_price
      }
    })

    res.json(projectsWithCounts)
  } catch (error) {
    console.error('Get projects error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// =============================================
// TEKLİF SİSTEMİ ENDPOINT'LERİ
// =============================================

// Get quotation requests for supplier (teklif bekleyen projeler)
router.get('/quotations', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ error: 'Bu endpoint sadece tedarikçiler içindir.' })
    }

    console.log('=== QUOTATIONS START ===', req.user.username, req.user.id)

    // Create FRESH Supabase client for this request
    const { createClient } = await import('@supabase/supabase-js')
    const freshClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get ALL data in ONE query using proper join
    const { data: quotations, error } = await freshClient
      .from('project_suppliers')
      .select(`
        id,
        project_id,
        supplier_id,
        status,
        quoted_price,
        quoted_note,
        delivery_date,
        quoted_at,
        assigned_at
      `)
      .eq('supplier_id', req.user.id)
      .in('status', ['pending', 'quoted'])
    
    console.log('Quotations found:', quotations?.length, 'Error:', error?.message)
    
    if (error) {
      console.error('Quotations query error:', error)
      throw error
    }
    if (!quotations?.length) return res.json([])

    // Get all project IDs
    const projectIds = quotations.map(q => q.project_id)
    console.log('Project IDs:', projectIds)

    // Fetch ALL projects in ONE query with FRESH client
    const { data: projects, error: pErr } = await freshClient
      .from('projects')
      .select('*')
      .in('id', projectIds)
    
    console.log('Projects found:', projects?.length, 'Error:', pErr?.message)

    // Create project map
    const projectMap = new Map()
    for (const p of (projects || [])) {
      projectMap.set(p.id, p)
    }

    // Get all creators in ONE query
    const creatorIds = [...new Set((projects || []).map(p => p.created_by).filter(Boolean))]
    const { data: creators } = await freshClient
      .from('profiles')
      .select('id, username, company_name')
      .in('id', creatorIds)
    
    const creatorMap = new Map()
    for (const c of (creators || [])) {
      creatorMap.set(c.id, c)
    }

    // Get all project files in ONE query
    const { data: allFiles } = await freshClient
      .from('project_files')
      .select('*')
      .in('project_id', projectIds)
    
    const filesMap = new Map()
    for (const f of (allFiles || [])) {
      if (!filesMap.has(f.project_id)) {
        filesMap.set(f.project_id, [])
      }
      filesMap.get(f.project_id).push(f)
    }

    // Build results
    const results = []
    for (const q of quotations) {
      const project = projectMap.get(q.project_id)
      if (!project) {
        console.log('Project not in map:', q.project_id)
        continue
      }

      const creator = creatorMap.get(project.created_by)
      
      results.push({
        ...q,
        project: {
          ...project,
          creator_name: creator?.company_name || creator?.username || 'Müşteri',
          project_files: filesMap.get(project.id) || []
        }
      })
    }

    console.log('=== QUOTATIONS END === Results:', results.length)
    res.json(results)
  } catch (error) {
    console.error('Get quotations error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Save draft quotation items (tedarikçi taslak teklif kaydet)
router.post('/quotations/:projectId/draft', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ error: 'Sadece tedarikçiler taslak kaydedebilir.' })
    }

    const { projectId } = req.params
    const { items, delivery_date } = req.body

    console.log('Save draft quotation:', { projectId, userId: req.user.id, itemCount: items?.length })

    // Check if quotation record exists
    const { data: existingQuotation } = await supabaseAdmin
      .from('quotations')
      .select('id, status')
      .eq('project_id', projectId)
      .eq('supplier_id', req.user.id)
      .single()

    let quotationId

    if (existingQuotation) {
      // Only allow draft save if status is 'pending' (not yet submitted)
      if (existingQuotation.status !== 'pending') {
        return res.status(400).json({ error: 'Teklif zaten gönderilmiş, taslak kaydedilemez.' })
      }
      quotationId = existingQuotation.id
      
      // Update delivery date if provided
      if (delivery_date) {
        await supabaseAdmin
          .from('quotations')
          .update({ delivery_date })
          .eq('id', quotationId)
      }
    } else {
      // Create new quotation record with pending status
      const { data: newQuotation, error: createError } = await supabaseAdmin
        .from('quotations')
        .insert({
          project_id: projectId,
          supplier_id: req.user.id,
          status: 'pending',
          delivery_date: delivery_date || null
        })
        .select()
        .single()

      if (createError) {
        console.error('Create quotation error:', createError)
        return res.status(500).json({ error: 'Teklif oluşturulamadı.' })
      }
      quotationId = newQuotation.id
    }

    // Delete existing draft items and insert new ones
    if (items && Array.isArray(items) && items.length > 0) {
      // Delete existing items for this quotation
      await supabaseAdmin
        .from('quotation_items')
        .delete()
        .eq('quotation_id', quotationId)

      // Insert new items
      const itemsToInsert = items
        .filter(item => item.price && parseFloat(item.price) > 0)
        .map(item => ({
          quotation_id: quotationId,
          file_id: item.file_id || null,
          item_type: item.item_type || 'file',
          title: item.title || item.file_name || '',
          price: parseFloat(item.price),
          quantity: parseInt(item.quantity) || 1,
          notes: item.notes?.trim() || null
        }))

      if (itemsToInsert.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from('quotation_items')
          .insert(itemsToInsert)

        if (insertError) {
          console.error('Insert quotation items error:', insertError)
          return res.status(500).json({ error: 'Teklif kalemleri kaydedilemedi.' })
        }
      }
    }

    res.json({ message: 'Taslak kaydedildi.', quotation_id: quotationId })
  } catch (error) {
    console.error('Save draft quotation error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Submit quotation (tedarikçi teklif gönder)
router.post('/quotations/:projectId/submit', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ error: 'Sadece tedarikçiler teklif verebilir.' })
    }

    const { projectId } = req.params
    const { items, delivery_date, price, note } = req.body

    // Support both old (price/note) and new (items) format for backward compatibility
    const isItemBasedQuotation = items && Array.isArray(items)

    console.log('Submit quotation:', { projectId, userId: req.user.id, isItemBased: isItemBasedQuotation, itemCount: items?.length, delivery_date })

    if (!delivery_date) {
      return res.status(400).json({ error: 'Termin tarihi giriniz.' })
    }

    let totalPrice
    if (isItemBasedQuotation) {
      if (items.length === 0) {
        return res.status(400).json({ error: 'En az bir teklif kalemi giriniz.' })
      }
      // Calculate total price from items
      totalPrice = items.reduce((sum, item) => {
        const itemPrice = parseFloat(item.price) || 0
        const quantity = parseInt(item.quantity) || 1
        return sum + (itemPrice * quantity)
      }, 0)
    } else {
      // Old format
      totalPrice = parseFloat(price) || 0
    }

    if (!totalPrice || totalPrice <= 0) {
      return res.status(400).json({ error: 'Geçerli bir fiyat giriniz.' })
    }

    // Check if supplier has this quotation request
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('project_suppliers')
      .select('*')
      .eq('project_id', projectId)
      .eq('supplier_id', req.user.id)
      .maybeSingle()

    console.log('Existing quotation check:', { existing, checkError })

    if (!existing) {
      return res.status(404).json({ error: 'Bu proje için teklif isteğiniz bulunmuyor.' })
    }

    if (existing.status === 'accepted') {
      return res.status(400).json({ error: 'Bu teklif zaten kabul edilmiş.' })
    }

    if (existing.status === 'rejected') {
      return res.status(400).json({ error: 'Bu teklif reddedilmiş.' })
    }

    // Handle item-based quotations
    if (isItemBasedQuotation) {
      // Get or create quotations record
      let quotation
      const { data: existingQuotation } = await supabaseAdmin
        .from('quotations')
        .select('*')
        .eq('project_id', projectId)
        .eq('supplier_id', req.user.id)
        .maybeSingle()

      if (existingQuotation) {
        // Update existing quotation
        const { data: updated, error: updateError } = await supabaseAdmin
          .from('quotations')
          .update({
            total_price: totalPrice,
            delivery_date: delivery_date,
            status: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingQuotation.id)
          .select()
          .single()

        if (updateError) throw updateError
        quotation = updated

        // Delete old items
        await supabaseAdmin
          .from('quotation_items')
          .delete()
          .eq('quotation_id', existingQuotation.id)
      } else {
        // Create new quotation
        const { data: created, error: createError } = await supabaseAdmin
          .from('quotations')
          .insert({
            project_id: projectId,
            supplier_id: req.user.id,
            total_price: totalPrice,
            delivery_date: delivery_date,
            status: 'pending'
          })
          .select()
          .single()

        if (createError) throw createError
        quotation = created
      }

      // Insert quotation items
      const itemsToInsert = items.map(item => ({
        quotation_id: quotation.id,
        file_id: item.file_id || null,
        item_type: item.item_type || 'file',
        title: item.title || '',
        price: parseFloat(item.price),
        quantity: parseInt(item.quantity) || 1,
        notes: item.notes || null
      }))

      const { error: itemsError } = await supabaseAdmin
        .from('quotation_items')
        .insert(itemsToInsert)

      if (itemsError) throw itemsError
    }

    // Update project_suppliers status
    const updateData = {
      status: 'quoted',
      quoted_price: totalPrice,
      quoted_note: note || null,
      quoted_at: new Date().toISOString(),
      delivery_date: delivery_date
    }
    
    console.log('Attempting to update with data:', updateData, 'for id:', existing.id)
    
    // Try RPC first to bypass RLS
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('submit_quotation', {
      p_project_supplier_id: existing.id,
      p_quoted_price: totalPrice,
      p_quoted_note: note || null,
      p_delivery_date: delivery_date
    })

    if (rpcError) {
      console.error('RPC submit_quotation error:', rpcError)
      console.log('Falling back to regular update...')
      
      // Fallback to regular update
      const { data: updateResult, error, count } = await supabaseAdmin
        .from('project_suppliers')
        .update(updateData)
        .eq('id', existing.id)
        .select()

      console.log('Update result:', { updateResult, error, count, affectedRows: updateResult?.length })

      if (error) {
        console.error('Update error:', error)
        throw error
      }
      
      if (!updateResult || updateResult.length === 0) {
        console.error('⚠️ Update succeeded but no rows affected!')
        console.error('This might be a RLS policy issue')
      }
    } else {
      console.log('✅ RPC submit_quotation succeeded:', rpcResult)
    }

    // Fetch the updated record to return
    const { data: updated, error: selectError } = await supabaseAdmin
      .from('project_suppliers')
      .select('*')
      .eq('id', existing.id)
      .single()

    console.log('Select after update:', { updated, selectError })

    res.json({ 
      message: 'Teklif başarıyla gönderildi.', 
      quotation: updated || { id: existing.id, status: 'quoted', quoted_price: totalPrice },
      total_price: totalPrice
    })
  } catch (error) {
    console.error('Submit quotation error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Get quotations for a project (müşteri için - gelen teklifler)
router.get('/:projectId/quotations', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params

    console.log('Get project quotations:', { projectId, userId: req.user.id, role: req.user.role })

    const { createClient } = await import('@supabase/supabase-js')
    const freshClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: project, error: projectError } = await freshClient
      .from('projects')
      .select('created_by')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return res.status(404).json({ error: 'Proje bulunamadı.' })
    }

    // Admin can access all; customer (and customer users) can access if project belongs to their org
    if (req.user.role !== 'admin') {
      if (req.user.role === 'customer') {
        let allowedCreatorIds = [req.user.id]
        if (req.user.customer_id) {
          allowedCreatorIds.push(req.user.customer_id)
          const { data: siblingUsers } = await freshClient
            .from('customer_users')
            .select('user_id')
            .eq('customer_id', req.user.customer_id)
            .eq('status', 'active')
          if (siblingUsers?.length) allowedCreatorIds.push(...siblingUsers.map(u => u.user_id))
        }
        if (req.user.is_customer_admin) {
          const { data: customerUsers } = await freshClient
            .from('customer_users')
            .select('user_id')
            .eq('customer_id', req.user.id)
            .eq('status', 'active')
          if (customerUsers?.length) allowedCreatorIds.push(...customerUsers.map(u => u.user_id))
        }
        if (!allowedCreatorIds.includes(project.created_by)) {
          return res.status(403).json({ error: 'Bu projenin tekliflerini görme yetkiniz yok.' })
        }
      } else if (project.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Bu projenin tekliflerini görme yetkiniz yok.' })
      }
    }

    // Sync: Süresi dolan pending kayıtları expired yap; son 1 gün kala hatırlatma e-postası gönder
    const now = new Date().toISOString()
    const oneDayFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const { data: pendingRows } = await supabaseAdmin
      .from('project_suppliers')
      .select('id, supplier_id, status, quote_due_at, quote_reminder_sent_at')
      .eq('project_id', projectId)
      .eq('status', 'pending')
    if (pendingRows?.length > 0) {
      for (const row of pendingRows) {
        const due = row.quote_due_at
        if (due && due < now) {
          await supabaseAdmin.from('project_suppliers').update({ status: 'expired' }).eq('id', row.id)
        } else if (due && due >= now && due <= oneDayFromNow && !row.quote_reminder_sent_at) {
          try {
            const { data: proj } = await supabaseAdmin.from('projects').select('name').eq('id', projectId).single()
            const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(row.supplier_id)
            const email = authUser?.user?.email
            const name = authUser?.user?.user_metadata?.full_name || authUser?.user?.email || 'Tedarikçi'
            if (email && proj?.name) {
              await sendQuoteReminder1DayLeft(email, name, proj.name, due)
              await supabaseAdmin.from('project_suppliers').update({ quote_reminder_sent_at: now }).eq('id', row.id)
            }
          } catch (e) {
            console.warn('Quote reminder send skip:', row.id, e?.message)
          }
        }
      }
    }

    // Get all quotations from project_suppliers (main table)
    const { data: quotations, error } = await supabaseAdmin
      .from('project_suppliers')
      .select(`
        *,
        supplier:profiles(id, username, company_name)
      `)
      .eq('project_id', projectId)
      .order('quoted_at', { ascending: false, nullsFirst: false })

    if (error) throw error

    // For each quotation, fetch detailed items from quotations table
    const quotationsWithDetails = await Promise.all(
      (quotations || []).map(async (q) => {
        // Get quotation details from quotations table
        const { data: quotationData } = await supabaseAdmin
          .from('quotations')
          .select(`
            id,
            total_price,
            delivery_date,
            quotation_items(
              id,
              file_id,
              item_type,
              title,
              price,
              quantity,
              notes,
              file:project_files(id, file_name, file_type, revision)
            )
          `)
          .eq('project_id', projectId)
          .eq('supplier_id', q.supplier_id)
          .maybeSingle()

        return {
          ...q,
          quotation: quotationData ? [quotationData] : null
        }
      })
    )

    console.log('Quotations for project:', { count: quotationsWithDetails?.length })

    res.json(quotationsWithDetails || [])
  } catch (error) {
    console.error('Get project quotations error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Accept quotation (müşteri teklif kabul)
router.post('/:projectId/quotations/:supplierId/accept', authenticateToken, async (req, res) => {
  try {
    const { projectId, supplierId } = req.params
    console.log('Accept quotation request:', { projectId, supplierId, userId: req.user.id })

    // Create FRESH Supabase client for this request
    const { createClient } = await import('@supabase/supabase-js')
    const freshClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Check if user is the project creator
    const { data: project, error: projectError } = await freshClient
      .from('projects')
      .select('created_by, is_quotation, name, part_number, payment_due_date')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      console.log('Project not found for accept:', projectId, projectError?.message)
      return res.status(404).json({ error: 'Proje bulunamadı.' })
    }

    if (req.user.role !== 'admin' && project.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Bu işlemi yapma yetkiniz yok.' })
    }

    // Check if quotation exists and is quoted
    const { data: quotation, error: quotationError } = await freshClient
      .from('project_suppliers')
      .select('*')
      .eq('project_id', projectId)
      .eq('supplier_id', supplierId)
      .single()

    if (quotationError || !quotation) {
      console.log('Quotation not found:', quotationError?.message)
      return res.status(404).json({ error: 'Teklif bulunamadı.' })
    }

    if (quotation.status !== 'quoted') {
      return res.status(400).json({ error: 'Bu teklif henüz verilmemiş veya zaten işlenmiş.' })
    }

    // Get quotation items for contract
    const { data: quotationData } = await freshClient
      .from('quotations')
      .select(`
        id,
        total_price,
        delivery_date,
        quotation_items:quotation_items(
          *,
          file:project_files(id, file_name, file_type, revision)
        )
      `)
      .eq('project_id', projectId)
      .eq('supplier_id', supplierId)
      .maybeSingle()

    // Get customer and supplier info
    const { data: customer } = await freshClient
      .from('profiles')
      .select('username, company_name')
      .eq('id', req.user.id)
      .single()

    const { data: supplier } = await freshClient
      .from('profiles')
      .select('username, company_name')
      .eq('id', supplierId)
      .single()

    // Accept this quotation
    const { data: acceptResult, error: acceptError } = await freshClient
      .from('project_suppliers')
      .update({ 
        status: 'accepted',
        responded_at: new Date().toISOString()
      })
      .eq('project_id', projectId)
      .eq('supplier_id', supplierId)
      .select()

    console.log('Accept result:', { acceptResult, acceptError })

    // Reject all other quotations for this project
    await freshClient
      .from('project_suppliers')
      .update({ 
        status: 'rejected',
        responded_at: new Date().toISOString()
      })
      .eq('project_id', projectId)
      .neq('supplier_id', supplierId)

    // Update project: set assigned_to, deadline from quotation, and is_quotation = false
    const updateData = { 
      assigned_to: supplierId,
      is_quotation: false,
      status: 'pending'
    }
    
    // If supplier provided delivery_date in quotation, update project deadline
    if (quotation.delivery_date) {
      updateData.deadline = quotation.delivery_date
    }
    
    await freshClient
      .from('projects')
      .update(updateData)
      .eq('id', projectId)

    // Generate Contract PDF
    try {
      console.log('📄 Starting contract PDF generation...')
      const { generateContractPDF } = await import('../utils/contractPDF.js')
      
      const contractData = {
        projectId,
        projectName: project.name,
        projectPartNumber: project.part_number,
        customerName: customer.username,
        customerCompany: customer.company_name,
        supplierName: supplier.username,
        supplierCompany: supplier.company_name,
        quotationItems: quotationData?.quotation_items?.map(item => ({
          title: item.title || item.file?.file_name,
          file_name: item.file?.file_name,
          revision: item.file?.revision,
          quantity: item.quantity,
          price: item.price,
          notes: item.notes
        })) || [],
        totalPrice: quotationData?.total_price || quotation.quoted_price,
        deliveryDate: quotation.delivery_date ? new Date(quotation.delivery_date).toLocaleDateString('tr-TR') : 'Belirtilmemiş',
        contractDate: new Date().toLocaleDateString('tr-TR'),
        paymentDueDate: project.payment_due_date || null
      }

      console.log('📄 Contract data prepared:', { 
        project: contractData.projectName, 
        customer: contractData.customerCompany,
        supplier: contractData.supplierCompany,
        items: contractData.quotationItems.length,
        total: contractData.totalPrice
      })

      const pdfBuffer = await generateContractPDF(contractData)
      console.log('✅ PDF generated, size:', pdfBuffer.length, 'bytes')
      
      // Upload PDF to Supabase Storage (project-files bucket)
      const fileName = `contract_${projectId}_${Date.now()}.pdf`
      const { error: uploadError } = await freshClient.storage
        .from('project-files')
        .upload(fileName, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: false
        })

      if (uploadError) {
        console.error('❌ Contract PDF upload error:', uploadError)
      } else {
        console.log('✅ PDF uploaded to storage:', fileName)
        
        // Get public URL
        const { data: { publicUrl } } = freshClient.storage
          .from('project-files')
          .getPublicUrl(fileName)

        console.log('📎 Public URL:', publicUrl)

        // Save contract to project_files table (proje dosyaları arasında görünsün)
        const { error: fileError } = await freshClient
          .from('project_files')
          .insert({
            project_id: projectId,
            file_name: `📄 Sözleşme_${project.name}.pdf`,
            file_type: 'pdf',
            file_url: publicUrl,
            file_path: fileName,
            file_size: pdfBuffer.length,
            description: 'Otomatik oluşturulan sözleşme',
            is_active: true,
            order_index: 999 // En sonda görünsün
          })

        if (fileError) {
          console.error('❌ Contract file record error:', fileError)
        } else {
          console.log('✅ Contract saved to project_files')
        }

        // E-posta: tedarikçiye bildirim + sözleşme
        try {
          const { data: authUser } = await freshClient.auth.admin.getUserById(supplierId)
          const supplierEmail = authUser?.user?.email
          if (supplierEmail) {
            await sendContractEmailToSupplier(
              supplierEmail,
              supplier.username || supplier.company_name || 'Tedarikçi',
              project.name,
              pdfBuffer,
              publicUrl
            )
          } else {
            console.warn('⚠️ Supplier has no email, contract notification skipped:', supplierId)
          }
        } catch (emailErr) {
          console.error('❌ Contract email to supplier failed:', emailErr.message)
        }
      }
    } catch (pdfError) {
      console.error('❌ Contract PDF generation error:', pdfError)
      console.error('Stack:', pdfError.stack)
      // Don't fail the quotation acceptance, just log the error
    }

    res.json({ message: 'Teklif kabul edildi. Proje tedarikçiye atandı. Sözleşme oluşturuldu.' })
  } catch (error) {
    console.error('Accept quotation error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Reject quotation (müşteri teklif red)
router.post('/:projectId/quotations/:supplierId/reject', authenticateToken, async (req, res) => {
  try {
    const { projectId, supplierId } = req.params

    // Create FRESH Supabase client
    const { createClient } = await import('@supabase/supabase-js')
    const freshClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Check if user is the project creator
    const { data: project, error: projectError } = await freshClient
      .from('projects')
      .select('created_by')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return res.status(404).json({ error: 'Proje bulunamadı.' })
    }

    if (req.user.role !== 'admin' && project.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Bu işlemi yapma yetkiniz yok.' })
    }

    // Reject quotation
    const { error } = await freshClient
      .from('project_suppliers')
      .update({ 
        status: 'rejected',
        responded_at: new Date().toISOString()
      })
      .eq('project_id', projectId)
      .eq('supplier_id', supplierId)

    if (error) throw error

    res.json({ message: 'Teklif reddedildi.' })
  } catch (error) {
    console.error('Reject quotation error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Add customer note to quotation (müşteri teklif notu ekle)
router.post('/:projectId/quotations/:supplierId/note', authenticateToken, async (req, res) => {
  try {
    const { projectId, supplierId } = req.params
    const { customer_note } = req.body

    // Create FRESH Supabase client
    const { createClient } = await import('@supabase/supabase-js')
    const freshClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Check if user is the project creator
    const { data: project, error: projectError } = await freshClient
      .from('projects')
      .select('created_by')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return res.status(404).json({ error: 'Proje bulunamadı.' })
    }

    if (req.user.role !== 'admin' && project.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Bu işlemi yapma yetkiniz yok.' })
    }

    // Add customer note
    const { error } = await freshClient
      .from('project_suppliers')
      .update({ 
        customer_note,
        customer_note_at: new Date().toISOString()
      })
      .eq('project_id', projectId)
      .eq('supplier_id', supplierId)

    if (error) throw error

    res.json({ message: 'Not eklendi.' })
  } catch (error) {
    console.error('Add customer note error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Müşteri: süresi dolan tedarikçiye ek 1 gün ver
router.post('/:projectId/quotations/:supplierId/extend-deadline', authenticateToken, async (req, res) => {
  try {
    const { projectId, supplierId } = req.params
    const { createClient } = await import('@supabase/supabase-js')
    const freshClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: project, error: projectError } = await freshClient
      .from('projects')
      .select('created_by')
      .eq('id', projectId)
      .single()
    if (projectError || !project) return res.status(404).json({ error: 'Proje bulunamadı.' })
    if (req.user.role !== 'admin' && project.created_by !== req.user.id) return res.status(403).json({ error: 'Yetkiniz yok.' })
    const { data: ps, error: psError } = await freshClient
      .from('project_suppliers')
      .select('id, status, quote_due_at')
      .eq('project_id', projectId)
      .eq('supplier_id', supplierId)
      .single()
    if (psError || !ps) return res.status(404).json({ error: 'Teklif kaydı bulunamadı.' })
    if (ps.status !== 'expired') return res.status(400).json({ error: 'Sadece süresi dolan tekliflere ek süre verilebilir.' })
    const newDue = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await freshClient
      .from('project_suppliers')
      .update({
        status: 'pending',
        quote_due_at: newDue,
        quote_deadline_extended_at: new Date().toISOString(),
        quote_reminder_sent_at: null
      })
      .eq('id', ps.id)
    res.json({ message: '1 gün ek süre verildi.', quote_due_at: newDue })
  } catch (error) {
    console.error('Extend quote deadline error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Get single project with checklist
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    // Create FRESH Supabase client for this request
    const { createClient } = await import('@supabase/supabase-js')
    const freshClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: project, error } = await freshClient
      .from('projects')
      .select(`
        *,
        supplier:profiles!projects_assigned_to_fkey(id, username, company_name),
        creator:profiles!projects_created_by_fkey(username, company_name),
        project_suppliers(
          id,
          status,
          quoted_price,
          supplier:profiles(id, username, company_name)
        )
      `)
      .eq('id', req.params.id)
      .single()

    if (error || !project) {
      console.log('Project not found:', req.params.id, error?.message)
      return res.status(404).json({ error: 'Proje bulunamadı.' })
    }

    console.log('Project detail:', { id: project.id, name: project.name, is_quotation: project.is_quotation, status: project.status })

    // Check access and get supplier status
    let supplierQuotationStatus = null
    let canEditChecklist = false

    if (req.user.role === 'admin') {
      // Admin can access all projects
      canEditChecklist = true
    } else if (req.user.role === 'customer') {
      // Customer can access projects they created OR projects created by their customer admin/users
      let allowedCreatorIds = [req.user.id]
      
      // If user is a customer user (has customer_id), allow projects from their admin
      if (req.user.customer_id) {
        allowedCreatorIds.push(req.user.customer_id)
        
        // Also get projects from other users of the same customer
        const { data: siblingUsers } = await freshClient
          .from('customer_users')
          .select('user_id')
          .eq('customer_id', req.user.customer_id)
          .eq('status', 'active')
        
        if (siblingUsers && siblingUsers.length > 0) {
          allowedCreatorIds.push(...siblingUsers.map(u => u.user_id))
        }
      }
      
      // If user is customer admin, allow projects from their users
      if (req.user.is_customer_admin) {
        const { data: customerUsers } = await freshClient
          .from('customer_users')
          .select('user_id')
          .eq('customer_id', req.user.id)
          .eq('status', 'active')
        
        if (customerUsers && customerUsers.length > 0) {
          allowedCreatorIds.push(...customerUsers.map(u => u.user_id))
        }
      }
      
      // Check if project creator is in allowed list
      if (!allowedCreatorIds.includes(project.created_by)) {
        return res.status(403).json({ error: 'Bu projeye erişim yetkiniz yok.' })
      }
      canEditChecklist = false // Müşteri checklist düzenleyemez
    } else if (req.user.role === 'user') {
      // Check if supplier has access to this project (either as quotation or accepted)
      const { data: supplierStatus } = await freshClient
        .from('project_suppliers')
        .select('status, quoted_price, quoted_note, delivery_date, quoted_at, customer_note, customer_note_at')
        .eq('project_id', req.params.id)
        .eq('supplier_id', req.user.id)
        .single()

      if (!supplierStatus) {
        return res.status(403).json({ error: 'Bu projeye erişim yetkiniz yok.' })
      }

      supplierQuotationStatus = supplierStatus
      
      // Get quotation items if exists (including draft/pending status)
      const { data: quotationData } = await freshClient
        .from('quotations')
        .select(`
          id,
          status,
          total_price,
          delivery_date,
          quotation_items:quotation_items(
            *,
            file:project_files(id, file_name, file_type, revision)
          )
        `)
        .eq('project_id', req.params.id)
        .eq('supplier_id', req.user.id)
        .maybeSingle()

      if (quotationData) {
        supplierQuotationStatus.quotation_status = quotationData.status
        supplierQuotationStatus.delivery_date = quotationData.delivery_date || supplierStatus.delivery_date
        
        if (quotationData.quotation_items && quotationData.quotation_items.length > 0) {
          // Map items to include file info
          supplierQuotationStatus.quotation_items = quotationData.quotation_items.map(item => ({
            ...item,
            file_name: item.file?.file_name || item.title,
            file_type: item.file?.file_type,
            revision: item.file?.revision
          }))
        }
      }
      
      // Sadece kabul edilmiş tedarikçi checklist düzenleyebilir
      canEditChecklist = supplierStatus.status === 'accepted'
    }

    // Update status to reviewing if accepted user opens it
    if (req.user.role === 'user' && canEditChecklist && project.status === 'pending') {
      await freshClient
        .from('projects')
        .update({ status: 'reviewing' })
        .eq('id', req.params.id)
      project.status = 'reviewing'
    }

    // Get PROJECT-LEVEL checklist items (file_id = null)
    const { data: projectChecklist } = await freshClient
      .from('checklist_items')
      .select('*')
      .eq('project_id', req.params.id)
      .is('file_id', null)
      .order('order_index', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })

    // Get FILE-LEVEL checklist items (grouped by file_id)
    const { data: fileChecklist } = await freshClient
      .from('checklist_items')
      .select('*')
      .eq('project_id', req.params.id)
      .not('file_id', 'is', null)
      .order('order_index', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })

    // Organize project checklist with hierarchy (parent/child)
    const organizeHierarchy = (items) => {
      const parentItems = items.filter(i => !i.parent_id)
      const childItems = items.filter(i => i.parent_id)
      
      return parentItems.map(parent => ({
        ...parent,
        children: childItems.filter(child => child.parent_id === parent.id)
      }))
    }

    // Group file checklists by file_id
    const fileChecklistMap = {}
    if (fileChecklist) {
      fileChecklist.forEach(item => {
        if (!fileChecklistMap[item.file_id]) {
          fileChecklistMap[item.file_id] = []
        }
        fileChecklistMap[item.file_id].push(item)
      })
      
      // Organize each file's checklist hierarchically
      Object.keys(fileChecklistMap).forEach(fileId => {
        fileChecklistMap[fileId] = organizeHierarchy(fileChecklistMap[fileId])
      })
    }

    // Organize project checklist hierarchically
    const checklist = organizeHierarchy(projectChecklist || [])

    // Get documents
    const { data: documents } = await freshClient
      .from('documents')
      .select('*')
      .eq('project_id', req.params.id)
      .order('uploaded_at', { ascending: false })

    // Get project files (new multi-file system) - including inactive revisions
    const { data: projectFiles } = await freshClient
      .from('project_files')
      .select('*')
      .eq('project_id', req.params.id)
      .order('is_active', { ascending: false }) // Active files first
      .order('order_index', { ascending: true })

    // Get all assigned suppliers with their quotation status
    const { data: projectSuppliers } = await freshClient
      .from('project_suppliers')
      .select(`
        status,
        quoted_price,
        quoted_note,
        quoted_at,
        supplier:profiles(id, username, company_name)
      `)
      .eq('project_id', req.params.id)

    res.json({
      ...project,
      supplier_name: project.supplier?.company_name,
      supplier_username: project.supplier?.username,
      creator_username: project.creator?.username,
      creator_company: project.creator?.company_name,
      checklist: checklist || [],
      file_checklists: fileChecklistMap || {},
      documents: documents || [],
      project_files: projectFiles || [],
      suppliers: projectSuppliers || [],
      // For supplier view
      my_quotation_status: supplierQuotationStatus,
      can_edit_checklist: canEditChecklist
    })
  } catch (error) {
    console.error('Get project error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Stream project file (avoids CORS when frontend fetches R2/Supabase URL)
router.get('/:projectId/files/:fileId/stream', authenticateToken, async (req, res) => {
  try {
    const { projectId, fileId } = req.params
    const { createClient } = await import('@supabase/supabase-js')
    const freshClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: project, error: projErr } = await freshClient
      .from('projects')
      .select('id, created_by')
      .eq('id', projectId)
      .single()

    if (projErr || !project) return res.status(404).json({ error: 'Proje bulunamadı.' })

    if (req.user.role === 'admin') {
      // ok
    } else if (req.user.role === 'customer') {
      let allowedCreatorIds = [req.user.id]
      if (req.user.customer_id) allowedCreatorIds.push(req.user.customer_id)
      if (req.user.is_customer_admin) {
        const { data: customerUsers } = await freshClient.from('customer_users').select('user_id').eq('customer_id', req.user.id).eq('status', 'active')
        if (customerUsers?.length) allowedCreatorIds.push(...customerUsers.map(u => u.user_id))
      }
      const { data: siblingUsers } = await freshClient.from('customer_users').select('user_id').eq('customer_id', req.user.customer_id).eq('status', 'active')
      if (siblingUsers?.length) allowedCreatorIds.push(...siblingUsers.map(u => u.user_id))
      if (!allowedCreatorIds.includes(project.created_by)) return res.status(403).json({ error: 'Bu projeye erişim yetkiniz yok.' })
    } else if (req.user.role === 'user') {
      const { data: supplierStatus } = await freshClient.from('project_suppliers').select('id').eq('project_id', projectId).eq('supplier_id', req.user.id).single()
      if (!supplierStatus) return res.status(403).json({ error: 'Bu projeye erişim yetkiniz yok.' })
    } else {
      return res.status(403).json({ error: 'Yetkisiz.' })
    }

    const { data: fileRow, error: fileErr } = await freshClient
      .from('project_files')
      .select('file_path, file_url, file_name, file_type')
      .eq('id', fileId)
      .eq('project_id', projectId)
      .single()

    if (fileErr || !fileRow) return res.status(404).json({ error: 'Dosya bulunamadı.' })

    const contentType = fileRow.file_type === 'step' || fileRow.file_type === 'stp'
      ? 'application/octet-stream'
      : fileRow.file_type === 'pdf'
        ? 'application/pdf'
        : 'application/octet-stream'

    if (isR2Key(fileRow.file_path)) {
      const workerBase = process.env.R2_WORKER_URL?.replace(/\/$/, '')
      const r2PublicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, '')
      const directUrl = (fileRow.file_url && fileRow.file_url.startsWith('http') && (fileRow.file_url.includes(r2PublicBase || 'r2.dev')))
        ? fileRow.file_url
        : r2PublicBase ? `${r2PublicBase}/${fileRow.file_path}` : null

      if (workerBase) {
        const workerFileUrl = `${workerBase}/file?key=${encodeURIComponent(fileRow.file_path)}`
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 60000)
          const wr = await fetch(workerFileUrl, { signal: controller.signal })
          clearTimeout(timeoutId)
          if (wr.ok) {
            res.setHeader('Content-Type', wr.headers.get('content-type') || contentType)
            res.setHeader('Cache-Control', 'private, max-age=3600')
            const nodeStream = Readable.fromWeb(wr.body)
            nodeStream.pipe(res)
            return
          }
        } catch (e) {
          if (process.env.NODE_ENV !== 'production') console.log('R2 Worker fetch failed:', e.message)
        }
      }

      if (directUrl) {
        const curl = spawn('curl', ['-fsSL', '-N', '--tlsv1.2', '--connect-timeout', '15', '--max-time', '120', directUrl], { stdio: ['ignore', 'pipe', 'pipe'] })
        let sentHeaders = false
        curl.stdout.on('data', (chunk) => {
          if (!sentHeaders) {
            if (process.env.NODE_ENV !== 'production') res.setHeader('X-Debug-Stream-Url', directUrl)
            res.setHeader('Content-Type', contentType)
            res.setHeader('Cache-Control', 'private, max-age=3600')
            sentHeaders = true
          }
          res.write(chunk)
        })
        curl.stdout.on('end', () => { if (sentHeaders) res.end() })
        curl.stderr.on('data', (d) => console.error('R2 curl stderr:', d?.toString()))
        curl.on('error', (err) => {
          console.error('R2 curl spawn error:', err)
          if (!sentHeaders) res.status(502).json({ error: 'Dosya alınamadı.' })
        })
        curl.on('close', (code, signal) => {
          if (process.env.NODE_ENV !== 'production') {
            console.log('R2 curl close:', { code, signal, hadData: sentHeaders, url: directUrl?.slice(-60) })
          }
          if (!sentHeaders) res.status(502).json({ error: 'Dosya alınamadı.' })
        })
        req.on('close', () => { try { curl.kill() } catch (_) {} })
        return
      }
      const streamData = await getR2ObjectStream(fileRow.file_path)
      if (!streamData) return res.status(404).json({ error: 'Dosya depoda bulunamadı.' })
      res.setHeader('Content-Type', streamData.contentType)
      if (streamData.contentLength != null) res.setHeader('Content-Length', String(streamData.contentLength))
      res.setHeader('Cache-Control', 'private, max-age=3600')
      streamData.body.pipe(res)
      return
    }

    if (fileRow.file_url) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)
      const resp = await fetch(fileRow.file_url, { signal: controller.signal })
      clearTimeout(timeoutId)
      if (!resp.ok) return res.status(502).json({ error: 'Dosya alınamadı.' })
      const ct = resp.headers.get('content-type') || contentType
      res.setHeader('Content-Type', ct)
      res.setHeader('Cache-Control', 'private, max-age=3600')
      const nodeStream = Readable.fromWeb(resp.body)
      nodeStream.pipe(res)
      return
    }

    return res.status(404).json({ error: 'Dosya URL bulunamadı.' })
  } catch (error) {
    if (error.name === 'AbortError') return res.status(504).json({ error: 'Dosya zaman aşımı.' })
    console.error('Stream project file error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Get checklist templates
router.get('/checklist-templates', authenticateToken, async (req, res) => {
  try {
    const { data: templates, error } = await supabaseAdmin
      .from('checklist_templates')
      .select('*')
      .eq('is_active', true)
      .order('order_index', { ascending: true })

    if (error) throw error

    res.json(templates || [])
  } catch (error) {
    console.error('Get checklist templates error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Create new project (admin or customer) - UPDATED for multi-file & multi-supplier
router.post('/', authenticateToken, requireAdminOrCustomer, async (req, res) => {
  try {
    const { name, part_number, assigned_to, suppliers, deadline, payment_due_date, checklist, files, use_standard_checklist } = req.body

    console.log('Create project request:', { name, suppliers, assigned_to })

    // Support both single assigned_to and multiple suppliers
    const supplierIds = suppliers || (assigned_to ? [assigned_to] : [])
    
    console.log('Supplier IDs to add:', supplierIds)

    if (!name) {
      return res.status(400).json({ error: 'Proje adı gerekli.' })
    }

    if (supplierIds.length === 0) {
      return res.status(400).json({ error: 'En az bir tedarikçi seçilmelidir.' })
    }

    // Create project (assigned_to will be the first supplier for backwards compatibility)
    const projectData = {
      name,
      part_number: part_number || null,
      assigned_to: supplierIds[0], // First supplier for backwards compat
      created_by: req.user.id,
      deadline: deadline || null,
      payment_due_date: payment_due_date || null,
      is_quotation: true
    }
    
    console.log('Project data to insert:', JSON.stringify(projectData))
    
    console.log('Inserting project:', projectData)
    
    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .insert(projectData)
      .select()
      .single()

    console.log('Project insert result:', { project, error })

    if (error) {
      console.error('Project insert error:', error)
      throw error
    }
    
    console.log('Project created successfully:', project.id, project.name)
    
    // VERIFY: Check if project actually exists
    const { data: verifyProject, error: verifyError } = await supabaseAdmin
      .from('projects')
      .select('id, name')
      .eq('id', project.id)
      .single()
    
    console.log('VERIFY after insert:', { exists: !!verifyProject, verifyError })

    // Add all suppliers to project_suppliers table with pending status; 3 gün teklif süresi
    const quoteDueAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    const supplierRecords = supplierIds.map(supplierId => ({
      project_id: project.id,
      supplier_id: supplierId,
      status: 'pending',
      quote_due_at: quoteDueAt
    }))

    console.log('Supplier records to insert:', supplierRecords)

    const { data: insertedSuppliers, error: suppliersError } = await supabaseAdmin
      .from('project_suppliers')
      .insert(supplierRecords)
      .select()

    console.log('Inserted suppliers:', insertedSuppliers)
    
    if (suppliersError) {
      console.error('Add suppliers error:', suppliersError)
    }

    // E-posta: atanan tedarikçilere teklif talebi bildirimi (3 gün süre); hangi müşterinin atadığı da yazılır
    if (insertedSuppliers && insertedSuppliers.length > 0) {
      const { createClient } = await import('@supabase/supabase-js')
      const mailClient = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const { data: creatorProfile } = await mailClient
        .from('profiles')
        .select('company_name, username')
        .eq('id', req.user.id)
        .single()
      const customerName = creatorProfile?.company_name || creatorProfile?.username || null
      for (const ps of insertedSuppliers) {
        try {
          const { data: authUser } = await mailClient.auth.admin.getUserById(ps.supplier_id)
          const email = authUser?.user?.email
          const name = authUser?.user?.user_metadata?.full_name || authUser?.user?.email || 'Tedarikçi'
          if (email) {
            await sendQuoteRequestToSupplier(email, name, project.name, quoteDueAt, customerName)
          }
        } catch (e) {
          console.warn('Quote request email skip for supplier', ps.supplier_id, e?.message)
        }
      }
    }

    // Add project files if provided
    if (files && files.length > 0) {
      const fileRecords = files.map((file, index) => ({
        project_id: project.id,
        file_name: file.file_name,
        file_type: file.file_type,
        file_url: file.file_url,
        file_path: file.temp_path,
        file_size: file.file_size || 0,
        description: file.description || null,
        quantity: file.quantity ?? 1,
        notes: file.notes || null,
        order_index: index,
        is_active: true,
        status: 'active'
      }))

      const { error: filesError } = await supabaseAdmin
        .from('project_files')
        .insert(fileRecords)

      if (filesError) {
        console.error('Add files error:', filesError)
        await supabaseAdmin.from('projects').delete().eq('id', project.id)
        return res.status(400).json({
          error: 'Dosyalar kaydedilemedi. Lütfen dosya türlerini kontrol edip tekrar deneyin.',
          details: filesError.message
        })
      }
    }

    // Add PROJECT-LEVEL checklist items (file_id = null)
    let projectChecklistItems = []

    if (use_standard_checklist) {
      // Get standard checklist templates for project level
      const { data: templates } = await supabaseAdmin
        .from('checklist_templates')
        .select('name, description, order_index')
        .eq('is_active', true)
        .order('order_index', { ascending: true })

      if (templates) {
        projectChecklistItems = templates.map((template, index) => ({
          project_id: project.id,
          title: template.name,
          order_index: template.order_index || index + 1,
          file_id: null,
          parent_id: null
        }))
      }
    } else if (checklist && checklist.length > 0) {
      projectChecklistItems = checklist
        .filter(item => (typeof item === 'string' ? item.trim() !== '' : item.title?.trim() !== ''))
        .map((item, index) => ({
          project_id: project.id,
          title: typeof item === 'string' ? item : item.title,
          order_index: index + 1,
          file_id: null,
          parent_id: null
        }))
    }

    if (projectChecklistItems.length > 0) {
      await supabaseAdmin.from('checklist_items').insert(projectChecklistItems)
    }

    // Add FILE-LEVEL checklist items for STEP files
    if (files && files.length > 0) {
      // Get inserted file records to get their IDs
      const { data: insertedFiles } = await supabaseAdmin
        .from('project_files')
        .select('id, file_type, file_name')
        .eq('project_id', project.id)

      // Get STEP checklist templates
      const { data: stepTemplates } = await supabaseAdmin
        .from('step_checklist_templates')
        .select('id, name, description, order_index')
        .eq('is_active', true)
        .order('order_index', { ascending: true })

      if (insertedFiles && stepTemplates) {
        const cadFileTypes = ['step', 'dxf', 'iges', 'parasolid']
        const stepFiles = insertedFiles.filter(f => cadFileTypes.includes(f.file_type))
        
        for (const stepFile of stepFiles) {
          // First, insert parent items (description = 'PARENT')
          const parentTemplates = stepTemplates.filter(t => t.description === 'PARENT')
          const parentItems = []
          
          for (const template of parentTemplates) {
            const { data: insertedParent } = await supabaseAdmin
              .from('checklist_items')
              .insert({
                project_id: project.id,
                file_id: stepFile.id,
                title: template.name,
                order_index: template.order_index,
                parent_id: null
              })
              .select()
              .single()
            
            if (insertedParent) {
              parentItems.push({ templateOrderIndex: template.order_index, parentId: insertedParent.id })
            }
          }
          
          // Then, insert child items with parent_id
          const childTemplates = stepTemplates.filter(t => t.description !== 'PARENT')
          const childItems = []
          
          for (const template of childTemplates) {
            // Find parent by order_index grouping (e.g., 101-103 belong to 100)
            const parentGroup = Math.floor(template.order_index / 100) * 100
            const parent = parentItems.find(p => p.templateOrderIndex === parentGroup)
            
            childItems.push({
              project_id: project.id,
              file_id: stepFile.id,
              title: template.name,
              order_index: template.order_index,
              parent_id: parent ? parent.parentId : null
            })
          }
          
          if (childItems.length > 0) {
            await supabaseAdmin.from('checklist_items').insert(childItems)
          }
        }
      }
    }

    res.status(201).json({ id: project.id, message: 'Proje başarıyla oluşturuldu.' })
  } catch (error) {
    console.error('Create project error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Update project STEP file (admin or customer)
router.patch('/:id/step-file', authenticateToken, requireAdminOrCustomer, async (req, res) => {
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
    const { is_checked, supplier_notes } = req.body
    const { projectId, itemId } = req.params

    // Create FRESH Supabase client
    const { createClient } = await import('@supabase/supabase-js')
    const freshClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify project access
    const { data: project } = await freshClient
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

    // Build update object
    const updateData = {}
    
    // Handle is_checked update
    if (typeof is_checked === 'boolean') {
      updateData.is_checked = is_checked
      updateData.checked_at = is_checked ? new Date().toISOString() : null
    }
    
    // Handle supplier_notes update (only for suppliers/users)
    if (typeof supplier_notes === 'string' && req.user.role === 'user') {
      updateData.supplier_notes = supplier_notes || null
      updateData.supplier_notes_at = supplier_notes ? new Date().toISOString() : null
    }

    // Get current item to check if it has a parent
    const { data: currentItem } = await freshClient
      .from('checklist_items')
      .select('parent_id')
      .eq('id', itemId)
      .single()

    // Update checklist item
    const { data: updatedItem, error } = await freshClient
      .from('checklist_items')
      .update(updateData)
      .eq('id', itemId)
      .eq('project_id', projectId)
      .select()
      .single()

    if (error) throw error

    // Track if parent was auto-checked/unchecked
    let parentAutoChecked = false
    let parentId = null

    // If this item has a parent, check if all siblings are checked
    // If so, auto-check the parent
    if (currentItem?.parent_id && is_checked === true) {
      const { data: siblings } = await freshClient
        .from('checklist_items')
        .select('is_checked')
        .eq('parent_id', currentItem.parent_id)

      const allSiblingsChecked = siblings?.every(s => s.is_checked)
      
      if (allSiblingsChecked) {
        await freshClient
          .from('checklist_items')
          .update({ 
            is_checked: true, 
            checked_at: new Date().toISOString() 
          })
          .eq('id', currentItem.parent_id)
        
        parentAutoChecked = true
        parentId = currentItem.parent_id
      }
    }

    // If unchecking a child, also uncheck the parent
    if (currentItem?.parent_id && is_checked === false) {
      await freshClient
        .from('checklist_items')
        .update({ 
          is_checked: false, 
          checked_at: null 
        })
        .eq('id', currentItem.parent_id)
      
      parentAutoChecked = false
      parentId = currentItem.parent_id
    }

    // Check if all items are checked (only project-level items for progress)
    const { count: total } = await freshClient
      .from('checklist_items')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .is('file_id', null)
      .is('parent_id', null)

    const { count: checked } = await freshClient
      .from('checklist_items')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .is('file_id', null)
      .is('parent_id', null)
      .eq('is_checked', true)

    res.json({
      message: 'Checklist güncellendi.',
      all_checked: total === checked,
      item: updatedItem,
      parent_auto_checked: parentAutoChecked,
      parent_id: parentId
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

    // Complete the project (no checklist requirement)
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

// Add checklist item (admin or customer) - supports parent_id and file_id
router.post('/:id/checklist', authenticateToken, requireAdminOrCustomer, async (req, res) => {
  try {
    const { title, parent_id, file_id } = req.body

    if (!title) {
      return res.status(400).json({ error: 'Checklist maddesi başlığı gerekli.' })
    }

    // Get the max order_index for proper ordering
    const { data: maxOrder } = await supabaseAdmin
      .from('checklist_items')
      .select('order_index')
      .eq('project_id', req.params.id)
      .eq('parent_id', parent_id || null)
      .eq('file_id', file_id || null)
      .order('order_index', { ascending: false })
      .limit(1)
      .single()

    const newOrderIndex = (maxOrder?.order_index || 0) + 1

    const insertData = { 
      project_id: req.params.id, 
      title,
      order_index: newOrderIndex,
      parent_id: parent_id || null,
      file_id: file_id || null
    }

    const { data, error } = await supabaseAdmin
      .from('checklist_items')
      .insert(insertData)
      .select()
      .single()

    if (error) throw error

    // If adding a child item, uncheck the parent (since it now has incomplete children)
    if (parent_id) {
      await supabaseAdmin
        .from('checklist_items')
        .update({ is_checked: false, checked_at: null })
        .eq('id', parent_id)
    }

    res.status(201).json({ id: data.id, item: data, message: 'Checklist maddesi eklendi.' })
  } catch (error) {
    console.error('Add checklist item error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Delete checklist item (admin or customer)
router.delete('/:projectId/checklist/:itemId', authenticateToken, requireAdminOrCustomer, async (req, res) => {
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

// Delete document (user/supplier can delete their own, admin can delete any)
router.delete('/:projectId/documents/:documentId', authenticateToken, async (req, res) => {
  try {
    const { projectId, documentId } = req.params
    console.log('Delete document request:', { projectId, documentId, userId: req.user.id, userRole: req.user.role })

    // Get document info
    const { data: document, error: fetchError } = await supabaseAdmin
      .from('documents')
      .select('*, project:projects(assigned_to, created_by)')
      .eq('id', documentId)
      .eq('project_id', projectId)
      .single()

    console.log('Document found:', document)
    console.log('Fetch error:', fetchError)

    if (fetchError || !document) {
      return res.status(404).json({ error: 'Döküman bulunamadı.' })
    }

    // Check permissions
    const canDelete = req.user.role === 'admin' || 
        (req.user.role === 'customer' && document.project.created_by === req.user.id) ||
        (req.user.role === 'user' && document.uploaded_by === req.user.id)
    
    console.log('Permission check:', { 
      canDelete, 
      userRole: req.user.role,
      documentUploadedBy: document.uploaded_by,
      userId: req.user.id,
      match: document.uploaded_by === req.user.id
    })

    if (canDelete) {
      // Delete from storage
      const fileName = document.file_path.split('/').pop()
      console.log('Deleting from storage:', fileName)
      
      const { error: storageError } = await supabaseAdmin.storage
        .from('documents')
        .remove([fileName])
      
      console.log('Storage delete error:', storageError)

      // Delete from database
      console.log('Deleting from database...')
      const { error: deleteError } = await supabaseAdmin
        .from('documents')
        .delete()
        .eq('id', documentId)

      console.log('Database delete error:', deleteError)
      if (deleteError) throw deleteError

      console.log('Document deleted successfully')
      res.json({ message: 'Döküman başarıyla silindi.' })
    } else {
      console.log('Permission denied')
      return res.status(403).json({ error: 'Bu dökümanı silme yetkiniz yok.' })
    }
  } catch (error) {
    console.error('Delete document error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Delete entire project (customer can delete their own projects)
router.delete('/:projectId', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params
    console.log('Delete project request:', { projectId, userId: req.user.id, role: req.user.role })

    // Get project to check ownership
    const { data: project, error: fetchError } = await supabaseAdmin
      .from('projects')
      .select('id, created_by, name')
      .eq('id', projectId)
      .single()

    if (fetchError || !project) {
      return res.status(404).json({ error: 'Proje bulunamadı.' })
    }

    // Only admin or project creator (customer) can delete
    if (req.user.role !== 'admin' && project.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Bu projeyi silme yetkiniz yok.' })
    }

    // Delete project files from storage first
    const { data: projectFiles } = await supabaseAdmin
      .from('project_files')
      .select('file_path')
      .eq('project_id', projectId)

    if (projectFiles && projectFiles.length > 0) {
      const filePaths = projectFiles.map(f => f.file_path).filter(Boolean)
      if (filePaths.length > 0) {
        await supabaseAdmin.storage.from('project-files').remove(filePaths)
      }
    }

    // First delete related records manually to ensure cascade works
    // Delete checklist items
    const { error: checklistErr } = await supabaseAdmin
      .from('checklist_items')
      .delete()
      .eq('project_id', projectId)
    console.log('Checklist items delete:', checklistErr ? checklistErr.message : 'OK')

    // Delete project suppliers
    const { error: suppliersErr } = await supabaseAdmin
      .from('project_suppliers')
      .delete()
      .eq('project_id', projectId)
    console.log('Project suppliers delete:', suppliersErr ? suppliersErr.message : 'OK')

    // Delete project files records
    const { error: filesErr } = await supabaseAdmin
      .from('project_files')
      .delete()
      .eq('project_id', projectId)
    console.log('Project files delete:', filesErr ? filesErr.message : 'OK')

    // Delete documents
    const { error: docsErr } = await supabaseAdmin
      .from('documents')
      .delete()
      .eq('project_id', projectId)
    console.log('Documents delete:', docsErr ? docsErr.message : 'OK')

    // Check for any remaining FK constraints - comments, notes, etc.
    // Delete any project-related comments if table exists
    try {
      await supabaseAdmin.from('comments').delete().eq('project_id', projectId)
    } catch (e) { /* table might not exist */ }

    // Finally delete the project
    const { error: deleteError, count } = await supabaseAdmin
      .from('projects')
      .delete({ count: 'exact' })
      .eq('id', projectId)

    console.log('Delete result:', { deleteError, count })

    if (deleteError) {
      console.error('Delete project error:', deleteError)
      throw deleteError
    }

    // Verify deletion by checking if project still exists
    const { data: verifyProject } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .maybeSingle()

    console.log('Verify after delete:', { projectStillExists: !!verifyProject })

    if (verifyProject) {
      console.error('Project still exists after delete - possible constraint')
      return res.status(500).json({ error: 'Proje silinemedi. Veritabanı kısıtlaması olabilir.' })
    }

    console.log('Project deleted successfully:', project.name)
    res.json({ success: true, message: 'Proje başarıyla silindi.' })
  } catch (error) {
    console.error('Delete project error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

export default router
