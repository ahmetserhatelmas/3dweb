import express from 'express'
import { supabaseAdmin } from '../db/supabase.js'
import { authenticateToken, requireAdminOrCustomer } from '../middleware/supabaseAuth.js'

const router = express.Router()

// =============================================
// REVİZYON İSTEKLERİ
// =============================================

// Get revision requests for a project
router.get('/projects/:projectId/revision-requests', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params

    console.log('Get revision requests:', { projectId, userId: req.user.id, role: req.user.role })

    // Check access - for suppliers, check project_suppliers table
    let hasAccess = false
    
    if (req.user.role === 'admin') {
      hasAccess = true
    } else if (req.user.role === 'customer') {
      const { data: project, error: projectError } = await supabaseAdmin
        .from('projects')
        .select('created_by')
        .eq('id', projectId)
        .maybeSingle()
      
      if (projectError) {
        console.error('Error checking project access:', projectError)
        return res.status(500).json({ error: 'Erişim kontrolü hatası.' })
      }
      
      hasAccess = project?.created_by === req.user.id
    } else if (req.user.role === 'user') {
      // Supplier: check if they have access via project_suppliers
      const { data: supplierAccess, error: supplierError } = await supabaseAdmin
        .from('project_suppliers')
        .select('id')
        .eq('project_id', projectId)
        .eq('supplier_id', req.user.id)
        .maybeSingle()
      
      if (supplierError) {
        console.error('Error checking supplier access:', supplierError)
        return res.status(500).json({ error: 'Erişim kontrolü hatası.' })
      }
      
      hasAccess = !!supplierAccess
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'Bu projeye erişim yetkiniz yok.' })
    }

    // Get revision requests with file info
    const { data: requests, error } = await supabaseAdmin
      .from('revision_requests')
      .select(`
        *,
        file:project_files!revision_requests_file_id_fkey(id, file_name, revision),
        requester:profiles!revision_requests_requested_by_fkey(username, company_name),
        responder:profiles!revision_requests_responded_by_fkey(username, company_name)
      `)
      .eq('project_id', projectId)
      .order('requested_at', { ascending: false })

    if (error) {
      console.error('Get revision requests query error:', error)
      throw error
    }

    console.log('Revision requests loaded:', requests?.length || 0)
    res.json(requests || [])
  } catch (error) {
    console.error('Get revision requests error:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    })
    res.status(500).json({ error: error.message || 'Sunucu hatası.' })
  }
})

// Create revision request (Customer only)
router.post('/projects/:projectId/files/:fileId/revise', authenticateToken, requireAdminOrCustomer, async (req, res) => {
  try {
    const { projectId, fileId } = req.params
    const { revision_type, description, new_quantity, affect_scope, new_file_url, new_file_path } = req.body

    console.log('Create revision request:', { 
      projectId, 
      fileId, 
      revision_type, 
      userId: req.user.id,
      body: req.body 
    })

    // Validate
    if (!['geometry', 'quantity', 'both'].includes(revision_type)) {
      console.error('Invalid revision type:', revision_type)
      return res.status(400).json({ error: 'Geçersiz revizyon tipi.' })
    }

    if ((revision_type === 'geometry' || revision_type === 'both') && !new_file_url) {
      console.error('Missing new_file_url for geometry revision')
      return res.status(400).json({ error: 'Geometri revizyonu için yeni dosya gerekli.' })
    }

    if ((revision_type === 'quantity' || revision_type === 'both') && !new_quantity) {
      console.error('Missing new_quantity for quantity revision')
      return res.status(400).json({ error: 'Adet revizyonu için yeni adet gerekli.' })
    }

    // Get current file info
    console.log('Looking for file:', { fileId, projectId, searchActive: true })
    
    const { data: currentFile, error: fileError } = await supabaseAdmin
      .from('project_files')
      .select('*')
      .eq('id', fileId)
      .eq('project_id', projectId)
      .eq('is_active', true)
      .single()

    console.log('File query result:', { 
      found: !!currentFile, 
      fileError, 
      revision: currentFile?.revision,
      isActive: currentFile?.is_active 
    })

    if (fileError || !currentFile) {
      console.error('File not found or inactive:', { fileId, fileError })
      return res.status(404).json({ error: 'Dosya bulunamadı.' })
    }

    // Calculate next revision
    const currentRevision = currentFile.revision || 'A'
    const nextRev = await calculateNextRevision(currentRevision)

    // Create revision request
    const requestData = {
      file_id: fileId,
      project_id: projectId,
      revision_type,
      from_revision: currentRevision,
      to_revision: nextRev,
      description,
      requested_by: req.user.id,
      status: 'pending'
    }

    // Add type-specific fields
    if (revision_type === 'geometry' || revision_type === 'both') {
      requestData.new_file_url = new_file_url
      requestData.new_file_path = new_file_path
      
      // Create a pending revision file immediately for preview
      const pendingFileData = {
        project_id: projectId,
        file_name: currentFile.file_name,
        file_type: currentFile.file_type,
        quantity: revision_type === 'both' ? new_quantity : currentFile.quantity,
        revision: nextRev,
        file_url: new_file_url,
        file_path: new_file_path,
        parent_file_id: fileId,
        is_active: false, // Not active yet
        status: 'pending', // Waiting for supplier approval
        description: `Revizyon ${nextRev} - Tedarikçi onayı bekleniyor`
      }
      
      const { data: pendingFile, error: pendingError } = await supabaseAdmin
        .from('project_files')
        .insert(pendingFileData)
        .select()
        .single()
      
      if (pendingError) {
        console.error('Error creating pending file:', pendingError)
      } else {
        console.log('Pending revision file created:', pendingFile.id)
        requestData.pending_file_id = pendingFile.id
      }
    }
    
    if (revision_type === 'quantity') {
      requestData.old_quantity = currentFile.quantity
      requestData.new_quantity = new_quantity
      requestData.affect_scope = affect_scope || 'file_only'
    } else if (revision_type === 'both') {
      requestData.old_quantity = currentFile.quantity
      requestData.new_quantity = new_quantity
      requestData.affect_scope = affect_scope || 'file_only'
    }

    const { data: request, error } = await supabaseAdmin
      .from('revision_requests')
      .insert(requestData)
      .select()
      .single()

    if (error) {
      console.error('Insert revision request error:', error)
      throw error
    }

    console.log('Revision request created successfully:', request)

    res.status(201).json({ 
      message: 'Revizyon talebi oluşturuldu. Tedarikçi onayını bekliyor.', 
      request 
    })
  } catch (error) {
    console.error('Create revision request error:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({ error: error.message || 'Sunucu hatası.' })
  }
})

// Accept revision request (Customer accepts supplier's quote)
router.post('/revision-requests/:requestId/accept', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params

    console.log('=== ACCEPT REVISION REQUEST STARTED ===')
    console.log('Accept revision request:', { requestId, userId: req.user.id, role: req.user.role })

    // Get request
    const { data: request, error: requestError } = await supabaseAdmin
      .from('revision_requests')
      .select('*, project:projects(assigned_to, created_by), file:project_files!revision_requests_file_id_fkey(*), pending_file_id')
      .eq('id', requestId)
      .single()

    if (requestError || !request) {
      return res.status(404).json({ error: 'Revizyon talebi bulunamadı.' })
    }

    console.log('Request details:', { 
      status: request.status, 
      projectCreatedBy: request.project.created_by, 
      currentUserId: req.user.id 
    })

    // Permission check: Customer (project owner) can accept when status is awaiting_customer_approval
    if (request.status === 'awaiting_customer_approval') {
      // Customer must be the project owner
      if (req.user.role !== 'admin' && req.user.role !== 'customer') {
        return res.status(403).json({ error: 'Sadece müşteri bu teklifi onaylayabilir.' })
      }
      if (req.user.role !== 'admin' && request.project.created_by !== req.user.id) {
        return res.status(403).json({ error: 'Bu projenin sahibi değilsiniz.' })
      }
    } else {
      return res.status(400).json({ error: 'Bu revizyon talebi henüz fiyatlandırılmamış veya zaten işlenmiş.' })
    }

    // Start transaction-like operations
    const now = new Date().toISOString()

    if (request.revision_type === 'geometry' || request.revision_type === 'both') {
      // Geometry revision (or both)
      console.log('Processing geometry revision. Request file:', request.file)
      console.log('File IDs:', { 
        request_file_id: request.file_id, 
        old_file_id: request.file?.id,
        pending_file_id: request.pending_file_id 
      })
      
      // Get the original active file (not the pending one)
      const { data: oldActiveFile, error: oldFileError } = await supabaseAdmin
        .from('project_files')
        .select('*')
        .eq('id', request.file_id)
        .single()
      
      if (oldFileError || !oldActiveFile) {
        console.error('Error fetching old active file:', oldFileError)
        throw new Error('Eski aktif dosya bulunamadı.')
      }
      
      console.log('Old active file found:', { 
        id: oldActiveFile.id, 
        revision: oldActiveFile.revision, 
        is_active: oldActiveFile.is_active,
        status: oldActiveFile.status
      })
      
      // 1. Deactivate old file (the original active file, not the pending one)
      // ALWAYS deactivate the old file, regardless of current state
      console.log('Deactivating old file (Rev A):', request.file_id)
      
      // Try RPC function first (more reliable, bypasses potential RLS issues)
      let deactivationSuccess = false
      try {
        const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('deactivate_project_file', {
          p_file_id: request.file_id
        })
        
        if (!rpcError && rpcResult) {
          console.log('File deactivated via RPC:', rpcResult)
          deactivationSuccess = true
        } else if (rpcError && rpcError.code !== 'PGRST202') {
          // PGRST202 = function not found, try regular update
          console.error('RPC deactivation error:', rpcError)
        }
      } catch (rpcErr) {
        console.log('RPC function not available, using regular update:', rpcErr.message)
      }
      
      // Fallback to regular update if RPC doesn't exist or failed
      if (!deactivationSuccess) {
        console.log('Using regular update method...')
        
        // Direct update - always set to inactive
        const { data: updateData, error: deactivateError, count } = await supabaseAdmin
          .from('project_files')
          .update({ 
            is_active: false,
            status: 'inactive'
          })
          .eq('id', request.file_id)
          .select('id, is_active, status')

        console.log('Update result:', { 
          data: updateData, 
          error: deactivateError, 
          count,
          file_id: request.file_id
        })

        if (deactivateError) {
          console.error('Error deactivating old file:', deactivateError)
          throw new Error(`Eski dosya pasif yapılamadı: ${deactivateError.message}`)
        }
        
        if (!updateData || updateData.length === 0) {
          console.error('WARNING: Update returned no rows. File ID:', request.file_id)
          throw new Error(`Eski dosya bulunamadı veya güncellenemedi. File ID: ${request.file_id}`)
        }
        
        console.log('Update successful, updated file:', updateData[0])
      }
      
      // Wait a bit for the update to propagate
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Verify the update worked - retry if needed
      let verifyAttempts = 0
      let verifyFile = null
      let verificationSuccess = false
      
      while (verifyAttempts < 5) {
        const { data: fetchedFile, error: verifyError } = await supabaseAdmin
          .from('project_files')
          .select('id, revision, is_active, status')
          .eq('id', request.file_id)
          .single()
        
        if (verifyError) {
          console.error('Error verifying deactivation:', verifyError)
          verifyAttempts++
          if (verifyAttempts < 5) {
            await new Promise(resolve => setTimeout(resolve, 200))
            continue
          } else {
            throw new Error(`Eski dosya pasif yapma doğrulaması başarısız: ${verifyError.message}`)
          }
        }
        
        verifyFile = fetchedFile
        
        if (verifyFile && verifyFile.is_active === false && verifyFile.status === 'inactive') {
          console.log('Old file deactivated successfully:', {
            id: verifyFile.id,
            revision: verifyFile.revision,
            is_active: verifyFile.is_active,
            status: verifyFile.status
          })
          verificationSuccess = true
          break
        }
        
        console.log(`Verification attempt ${verifyAttempts + 1} failed. Current state:`, {
          id: verifyFile?.id,
          is_active: verifyFile?.is_active,
          status: verifyFile?.status,
          expected: { is_active: false, status: 'inactive' }
        })
        
        verifyAttempts++
        if (verifyAttempts < 5) {
          console.log(`Retrying deactivation (attempt ${verifyAttempts + 1})...`)
          // Retry deactivation
          const { data: retryUpdateData, error: retryDeactivateError } = await supabaseAdmin
            .from('project_files')
            .update({ 
              is_active: false,
              status: 'inactive'
            })
            .eq('id', request.file_id)
            .select('id, is_active, status')
          
          if (retryDeactivateError) {
            console.error('Retry deactivation error:', retryDeactivateError)
          } else if (retryUpdateData && retryUpdateData.length > 0) {
            console.log('Retry update successful:', retryUpdateData[0])
          } else {
            console.error('Retry update returned no rows')
          }
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      }
      
      // Final check - throw error if deactivation failed
      if (!verificationSuccess || !verifyFile || verifyFile.is_active !== false || verifyFile.status !== 'inactive') {
        console.error('ERROR: File deactivation failed after all retries:', {
          id: verifyFile?.id,
          is_active: verifyFile?.is_active,
          status: verifyFile?.status,
          expected: { is_active: false, status: 'inactive' }
        })
        throw new Error('Eski dosya pasif yapılamadı. Lütfen tekrar deneyin.')
      }
      
      console.log('Old file (Rev A) successfully deactivated and verified')

      // 2. Create new file entry
      const oldFile = oldActiveFile // Use the fetched file, not request.file
      
      const newFileData = {
        project_id: oldFile.project_id,
        file_name: oldFile.file_name,
        file_type: oldFile.file_type,
        quantity: request.revision_type === 'both' ? request.new_quantity : oldFile.quantity, // Use new quantity if 'both'
        revision: request.to_revision,
        file_url: request.new_file_url,
        file_path: request.new_file_path,
        parent_file_id: request.file_id,
        is_active: true,
        status: 'active'
      }

      let newFile = null // Changed from const to let
      const { data: newFileData_result, error: newFileError } = await supabaseAdmin
        .from('project_files')
        .insert(newFileData)
        .select()
        .single()

      if (newFileError) {
        console.error('Create new file error:', newFileError)
        console.error('Attempted to insert:', JSON.stringify(newFileData, null, 2))
        
        // Try with RPC as fallback
        console.log('Trying RPC fallback...')
        const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('create_revision_file', {
          p_project_id: newFileData.project_id,
          p_file_name: newFileData.file_name,
          p_file_type: newFileData.file_type,
          p_quantity: newFileData.quantity,
          p_revision: newFileData.revision,
          p_file_url: newFileData.file_url,
          p_file_path: newFileData.file_path,
          p_parent_file_id: newFileData.parent_file_id
        })
        
        if (rpcError) {
          console.error('RPC also failed:', rpcError)
          throw newFileError // Throw original error
        }
        
        // Fetch the created file
        const { data: fetchedFile } = await supabaseAdmin
          .from('project_files')
          .select('*')
          .eq('id', rpcResult)
          .single()
        
        newFile = fetchedFile
      } else {
        newFile = newFileData_result
      }

      // 3. Copy checklist items to new file (with reset)
      const { data: oldChecklistItems } = await supabaseAdmin
        .from('checklist_items')
        .select('*')
        .eq('file_id', request.file_id)

      if (oldChecklistItems && oldChecklistItems.length > 0) {
        // If old file has checklist items, copy them (reset)
        const newChecklistItems = oldChecklistItems.map(item => ({
          project_id: item.project_id,
          file_id: newFile.id,
          title: item.title || item.step_description,
          order_index: item.order_index,
          parent_id: item.parent_id || null,
          is_checked: false,
          checked_at: null,
          supplier_notes: null,
          supplier_notes_at: null
        }))

        await supabaseAdmin
          .from('checklist_items')
          .insert(newChecklistItems)
      } else {
        // If old file has NO checklist items, add default STEP checklist
        console.log('No checklist found on old file, adding default STEP checklist...')
        
        const { data: stepTemplates } = await supabaseAdmin
          .from('step_checklist_templates')
          .select('name, description, order_index')
          .eq('is_active', true)
          .order('order_index', { ascending: true })

        if (stepTemplates && stepTemplates.length > 0) {
          const fileChecklistItems = stepTemplates.map((template, index) => ({
            project_id: request.project_id,
            file_id: newFile.id,
            title: template.name,
            order_index: template.order_index || index + 1,
            parent_id: null
          }))

          await supabaseAdmin
            .from('checklist_items')
            .insert(fileChecklistItems)
          
          console.log(`Added ${fileChecklistItems.length} default checklist items to new file`)
        }
      }

      // 4. Delete pending file if exists (no longer needed, we have the real file now)
      console.log('Checking for pending file to delete:', { 
        pending_file_id: request.pending_file_id,
        request_id: request.id,
        new_revision: request.to_revision,
        project_id: oldFile.project_id,
        file_name: oldFile.file_name
      })
      
      // Method 1: Delete by pending_file_id if available
      if (request.pending_file_id) {
        console.log('Deleting pending file by ID:', request.pending_file_id)
        
        // First verify it exists and is pending
        const { data: pendingFileCheck } = await supabaseAdmin
          .from('project_files')
          .select('id, revision, status, is_active, file_path, file_url')
          .eq('id', request.pending_file_id)
          .single()
        
        if (pendingFileCheck) {
          console.log('Pending file found before deletion:', {
            id: pendingFileCheck.id,
            revision: pendingFileCheck.revision,
            status: pendingFileCheck.status,
            is_active: pendingFileCheck.is_active,
            file_path: pendingFileCheck.file_path
          })
          
          // Delete from storage first if file_path exists
          if (pendingFileCheck.file_path) {
            try {
              const pathParts = pendingFileCheck.file_path.split('/')
              const bucket = pathParts[0] || 'project-files'
              const filePath = pathParts.slice(1).join('/')
              
              const { error: storageError } = await supabaseAdmin.storage
                .from(bucket)
                .remove([filePath])
              
              if (storageError) {
                console.error('Error deleting file from storage:', storageError, 'Path:', pendingFileCheck.file_path)
                // Continue with database deletion even if storage deletion fails
              } else {
                console.log('File deleted from storage:', pendingFileCheck.file_path)
              }
            } catch (storageErr) {
              console.error('Exception deleting from storage:', storageErr)
              // Continue with database deletion
            }
          }
          
          // Delete from database
          const { error: deletePendingError } = await supabaseAdmin
            .from('project_files')
            .delete()
            .eq('id', request.pending_file_id)
          
          if (deletePendingError) {
            console.error('Error deleting pending file by ID:', deletePendingError)
            throw deletePendingError // Throw to prevent continuing with pending file still there
          }
          
          // Verify deletion worked
          const { data: verifyDeleted } = await supabaseAdmin
            .from('project_files')
            .select('id')
            .eq('id', request.pending_file_id)
            .single()
          
          if (verifyDeleted) {
            console.error('WARNING: Pending file still exists after deletion! Retrying...')
            // Retry deletion
            const { error: retryError } = await supabaseAdmin
              .from('project_files')
              .delete()
              .eq('id', request.pending_file_id)
            
            if (retryError) {
              console.error('Retry deletion also failed:', retryError)
              throw retryError
            } else {
              console.log('Retry deletion succeeded')
            }
          } else {
            console.log('Pending file deleted successfully by ID:', {
              deleted_id: request.pending_file_id,
              deleted_revision: pendingFileCheck.revision
            })
          }
        } else {
          console.log('Pending file not found (may have been already deleted):', request.pending_file_id)
        }
      }
      
      // Method 2: Always try to find and delete pending files with same revision (fallback + cleanup)
      // Wait a bit for Method 1 to complete
      await new Promise(resolve => setTimeout(resolve, 100))
      
      console.log('Searching for remaining pending files to delete...')
      const { data: pendingFiles, error: findError } = await supabaseAdmin
        .from('project_files')
        .select('id, revision, status, is_active, file_path, parent_file_id')
        .eq('project_id', oldFile.project_id)
        .eq('file_name', oldFile.file_name)
        .eq('revision', request.to_revision)
        .eq('is_active', false)
        .or('status.eq.pending,status.is.null')
      
      if (findError) {
        console.error('Error finding pending files:', findError)
      } else if (pendingFiles && pendingFiles.length > 0) {
        console.log('Found remaining pending files to delete:', pendingFiles.map(f => ({ id: f.id, revision: f.revision, status: f.status, parent_file_id: f.parent_file_id })))
        for (const pendingFile of pendingFiles) {
          // Don't delete if it's the old active file (should be inactive now, not pending)
          if (pendingFile.id === request.file_id) {
            console.log('Skipping old active file (should be inactive, not pending):', pendingFile.id)
            continue
          }
          
          // Don't delete if it's the newly created active file (Rev B)
          if (newFile && pendingFile.id === newFile.id) {
            console.log('Skipping newly created active file:', pendingFile.id)
            continue
          }
          
          // Only delete if it's a child of the original file (pending preview file)
          if (pendingFile.parent_file_id !== request.file_id) {
            console.log('Skipping file that is not a child of the original file:', {
              id: pendingFile.id,
              parent_file_id: pendingFile.parent_file_id,
              expected_parent: request.file_id
            })
            continue
          }
          
          console.log('Deleting pending file:', pendingFile.id, 'Path:', pendingFile.file_path)
          
          // Delete from storage first if file_path exists
          if (pendingFile.file_path) {
            try {
              const pathParts = pendingFile.file_path.split('/')
              const bucket = pathParts[0] || 'project-files'
              const filePath = pathParts.slice(1).join('/')
              
              const { error: storageError } = await supabaseAdmin.storage
                .from(bucket)
                .remove([filePath])
              
              if (storageError) {
                console.error('Error deleting file from storage:', storageError, 'Path:', pendingFile.file_path)
                // Continue with database deletion even if storage deletion fails
              } else {
                console.log('File deleted from storage:', pendingFile.file_path)
              }
            } catch (storageErr) {
              console.error('Exception deleting from storage:', storageErr)
              // Continue with database deletion
            }
          }
          
          // Delete from database
          const { error: deleteError } = await supabaseAdmin
            .from('project_files')
            .delete()
            .eq('id', pendingFile.id)
          
          if (deleteError) {
            console.error('Error deleting found pending file:', deleteError)
          } else {
            // Verify deletion
            const { data: verifyDeleted } = await supabaseAdmin
              .from('project_files')
              .select('id')
              .eq('id', pendingFile.id)
              .single()
            
            if (verifyDeleted) {
              console.error('WARNING: Pending file still exists after deletion! ID:', pendingFile.id)
            } else {
              console.log('Found pending file deleted successfully:', pendingFile.id)
            }
          }
        }
      } else {
        console.log('No remaining pending files found to delete')
      }

    } else {
      // Quantity revision
      console.log('Processing quantity revision:', {
        fileId: request.file_id,
        oldQuantity: request.file[0]?.quantity,
        newQuantity: request.new_quantity,
        fromRevision: request.from_revision,
        toRevision: request.to_revision
      })

      // Use direct SQL query to bypass any potential RLS issues
      const { data: updateResult, error: updateError } = await supabaseAdmin.rpc('update_file_quantity_and_revision', {
        p_file_id: request.file_id,
        p_new_quantity: request.new_quantity,
        p_new_revision: request.to_revision
      })

      console.log('Quantity update via RPC:', { updateResult, updateError })

      // If RPC doesn't exist, fall back to regular update
      if (updateError && updateError.code === 'PGRST202') {
        console.log('RPC not found, using regular update...')
        
        const { error: regularUpdateError } = await supabaseAdmin
          .from('project_files')
          .update({ 
            quantity: request.new_quantity,
            revision: request.to_revision
          })
          .eq('id', request.file_id)

        if (regularUpdateError) {
          console.error('Regular update error:', regularUpdateError)
          throw regularUpdateError
        }
      } else if (updateError) {
        console.error('RPC update error:', updateError)
        throw updateError
      }

      // Verify the update
      const { data: updatedFile } = await supabaseAdmin
        .from('project_files')
        .select('*')
        .eq('id', request.file_id)
        .single()

      console.log('Updated file verification:', { 
        quantity: updatedFile?.quantity, 
        revision: updatedFile?.revision 
      })
    }

    // 5. Create history record
    const oldFileForHistory = request.file && request.file.length > 0 ? request.file[0] : request.file
    
    await supabaseAdmin
      .from('revision_history')
      .insert({
        file_id: request.file_id,
        project_id: request.project_id,
        revision_request_id: requestId,
        revision: request.to_revision,
        revision_type: request.revision_type,
        change_summary: request.description,
        old_value: request.revision_type === 'geometry' 
          ? { file_url: oldFileForHistory?.file_url }
          : { quantity: request.old_quantity },
        new_value: request.revision_type === 'geometry'
          ? { file_url: request.new_file_url }
          : { quantity: request.new_quantity },
        changed_by: req.user.id,
        checklist_reset: request.revision_type === 'geometry'
      })

    // 6. Update project revision if needed
    await updateProjectRevision(request.project_id)

    // 7. Update project price and deadline (if supplier provided)
    if (request.supplier_quoted_price && request.supplier_quoted_deadline) {
      await supabaseAdmin.rpc('update_project_price_and_deadline', {
        p_project_id: request.project_id,
        p_quoted_price: request.supplier_quoted_price,
        p_deadline: request.supplier_quoted_deadline
      })
    }

    // 8. Update request status (do this LAST after everything succeeds)
    await supabaseAdmin
      .from('revision_requests')
      .update({ 
        status: 'accepted',
        responded_by: req.user.id,
        responded_at: now
      })
      .eq('id', requestId)

    res.json({ message: 'Revizyon kabul edildi ve uygulandı.' })
  } catch (error) {
    console.error('Accept revision error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Supplier quotes revision (price & deadline)
router.post('/revision-requests/:requestId/quote', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params
    const { quoted_price, quoted_deadline, quoted_note } = req.body

    console.log('Supplier quote revision:', { requestId, userId: req.user.id, quoted_price, quoted_deadline })

    if (!quoted_price || !quoted_deadline) {
      return res.status(400).json({ error: 'Fiyat ve termin bilgisi gerekli.' })
    }

    // Get request
    const { data: request, error: requestError } = await supabaseAdmin
      .from('revision_requests')
      .select('*, project:projects(assigned_to)')
      .eq('id', requestId)
      .single()

    if (requestError || !request) {
      return res.status(404).json({ error: 'Revizyon talebi bulunamadı.' })
    }

    // Check if user is the assigned supplier
    if (req.user.role !== 'admin' && request.project.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Bu revizyon talebini fiyatlandırma yetkiniz yok.' })
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Bu revizyon talebi zaten işlenmiş.' })
    }

    // Update request with supplier quotation
    const { data: updatedRequest, error: updateError } = await supabaseAdmin
      .from('revision_requests')
      .update({ 
        status: 'awaiting_customer_approval',
        supplier_quoted_price: quoted_price,
        supplier_quoted_deadline: quoted_deadline,
        supplier_quoted_note: quoted_note || null,
        supplier_quoted_at: new Date().toISOString(),
        responded_by: req.user.id
      })
      .eq('id', requestId)
      .select()
      .single()

    if (updateError) {
      console.error('Update revision request error:', updateError)
      throw updateError
    }

    console.log('Quote updated successfully:', updatedRequest)

    res.json({ message: 'Revizyon teklifi gönderildi. Müşteri onayını bekliyor.' })
  } catch (error) {
    console.error('Quote revision error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Reject revision request (Supplier only)
router.post('/revision-requests/:requestId/reject', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.params
    const { rejection_reason } = req.body

    console.log('Reject revision request:', { requestId, userId: req.user.id })

    if (!rejection_reason) {
      return res.status(400).json({ error: 'Red nedeni gerekli.' })
    }

    // Get request
    const { data: request, error: requestError } = await supabaseAdmin
      .from('revision_requests')
      .select('*, project:projects(assigned_to), pending_file_id')
      .eq('id', requestId)
      .single()

    if (requestError || !request) {
      return res.status(404).json({ error: 'Revizyon talebi bulunamadı.' })
    }

    // Check permission
    if (req.user.role !== 'admin' && request.project.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Bu revizyon talebini reddetme yetkiniz yok.' })
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Bu revizyon talebi zaten işlenmiş.' })
    }

    // Delete pending file if exists
    if (request.pending_file_id) {
      console.log('Deleting pending file:', request.pending_file_id)
      const { error: deleteFileError } = await supabaseAdmin
        .from('project_files')
        .delete()
        .eq('id', request.pending_file_id)
      
      if (deleteFileError) {
        console.error('Error deleting pending file:', deleteFileError)
      } else {
        console.log('Pending file deleted successfully')
      }
    }

    // Update request status
    await supabaseAdmin
      .from('revision_requests')
      .update({ 
        status: 'rejected',
        rejection_reason,
        responded_by: req.user.id,
        responded_at: new Date().toISOString()
      })
      .eq('id', requestId)

    res.json({ message: 'Revizyon talebi reddedildi.' })
  } catch (error) {
    console.error('Reject revision error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Cancel revision request (Customer only - can cancel their own pending requests)
router.post('/revision-requests/:requestId/cancel', authenticateToken, requireAdminOrCustomer, async (req, res) => {
  try {
    const { requestId } = req.params

    console.log('Cancel revision request:', { requestId, userId: req.user.id })

    // Get request with pending file info
    const { data: request, error: requestError } = await supabaseAdmin
      .from('revision_requests')
      .select('*, project:projects(created_by), pending_file_id')
      .eq('id', requestId)
      .single()

    if (requestError || !request) {
      return res.status(404).json({ error: 'Revizyon talebi bulunamadı.' })
    }

    // Check permission - only the customer who created the request can cancel it
    if (req.user.role !== 'admin' && request.requested_by !== req.user.id) {
      return res.status(403).json({ error: 'Bu revizyon talebini iptal etme yetkiniz yok.' })
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Sadece bekleyen talepler iptal edilebilir.' })
    }

    // Get file info for fallback search
    const { data: originalFile } = await supabaseAdmin
      .from('project_files')
      .select('id, project_id, file_name, revision')
      .eq('id', request.file_id)
      .single()

    // For geometry/both revisions, always search and delete all pending files
    // This ensures we catch all preview files even if pending_file_id is missing or incorrect
    if ((request.revision_type === 'geometry' || request.revision_type === 'both') && originalFile) {
      console.log('Searching for all pending files to delete...', {
        project_id: originalFile.project_id,
        file_name: originalFile.file_name,
        to_revision: request.to_revision,
        file_id: request.file_id
      })

      // Find all pending files that match this revision request
      const { data: pendingFiles, error: findError } = await supabaseAdmin
        .from('project_files')
        .select('id, revision, status, parent_file_id, is_active, file_path, file_url')
        .eq('project_id', originalFile.project_id)
        .eq('file_name', originalFile.file_name)
        .eq('revision', request.to_revision)
        .or('status.eq.pending,status.is.null')
        .eq('is_active', false)
      
      if (findError) {
        console.error('Error finding pending files:', findError)
      } else if (pendingFiles && pendingFiles.length > 0) {
        // Filter to only include files that are children of the original file
        const filesToDelete = pendingFiles.filter(f => 
          f.parent_file_id === request.file_id || 
          (request.pending_file_id && f.id === request.pending_file_id)
        )
        
        console.log('Found pending files to delete:', filesToDelete.map(f => ({ 
          id: f.id, 
          revision: f.revision, 
          status: f.status,
          parent_file_id: f.parent_file_id,
          file_path: f.file_path
        })))
        
        // Delete all found pending files
        for (const pendingFile of filesToDelete) {
          console.log('Deleting pending file:', pendingFile.id, 'Path:', pendingFile.file_path)
          
          // Delete from storage first if file_path exists
          if (pendingFile.file_path) {
            try {
              const pathParts = pendingFile.file_path.split('/')
              const bucket = pathParts[0] || 'project-files'
              const filePath = pathParts.slice(1).join('/')
              
              const { error: storageError } = await supabaseAdmin.storage
                .from(bucket)
                .remove([filePath])
              
              if (storageError) {
                console.error('Error deleting file from storage:', storageError, 'Path:', pendingFile.file_path)
                // Continue with database deletion even if storage deletion fails
              } else {
                console.log('File deleted from storage:', pendingFile.file_path)
              }
            } catch (storageErr) {
              console.error('Exception deleting from storage:', storageErr)
              // Continue with database deletion
            }
          }
          
          // Delete from database
          const { error: deleteError } = await supabaseAdmin
            .from('project_files')
            .delete()
            .eq('id', pendingFile.id)
          
          if (deleteError) {
            console.error('Error deleting pending file from database:', deleteError, 'File ID:', pendingFile.id)
          } else {
            // Verify deletion
            const { data: verifyDeleted } = await supabaseAdmin
              .from('project_files')
              .select('id')
              .eq('id', pendingFile.id)
              .single()
            
            if (verifyDeleted) {
              console.error('WARNING: Pending file still exists after deletion! ID:', pendingFile.id)
            } else {
              console.log('Pending file deleted successfully from database:', pendingFile.id)
            }
          }
        }
      } else {
        console.log('No pending files found to delete')
      }
    } else if (request.pending_file_id) {
      // For quantity-only revisions, just delete by pending_file_id if it exists
      console.log('Deleting pending file by ID (quantity revision):', request.pending_file_id)
      
      // Get file info to delete from storage
      const { data: pendingFileInfo } = await supabaseAdmin
        .from('project_files')
        .select('id, file_path, file_url')
        .eq('id', request.pending_file_id)
        .single()
      
      // Delete from storage first if file_path exists
      if (pendingFileInfo?.file_path) {
        try {
          const pathParts = pendingFileInfo.file_path.split('/')
          const bucket = pathParts[0] || 'project-files'
          const filePath = pathParts.slice(1).join('/')
          
          const { error: storageError } = await supabaseAdmin.storage
            .from(bucket)
            .remove([filePath])
          
          if (storageError) {
            console.error('Error deleting file from storage:', storageError, 'Path:', pendingFileInfo.file_path)
          } else {
            console.log('File deleted from storage:', pendingFileInfo.file_path)
          }
        } catch (storageErr) {
          console.error('Exception deleting from storage:', storageErr)
        }
      }
      
      // Delete from database
      const { error: deleteFileError } = await supabaseAdmin
        .from('project_files')
        .delete()
        .eq('id', request.pending_file_id)
      
      if (deleteFileError) {
        console.error('Error deleting pending file by ID:', deleteFileError)
      } else {
        console.log('Pending file deleted successfully on cancel:', request.pending_file_id)
      }
    }

    // Delete the request completely (only pending requests can be cancelled)
    const { error: deleteError } = await supabaseAdmin
      .from('revision_requests')
      .delete()
      .eq('id', requestId)

    if (deleteError) {
      console.error('Delete revision request error:', deleteError)
      throw deleteError
    }

    res.json({ message: 'Revizyon talebi iptal edildi ve silindi.' })
  } catch (error) {
    console.error('Cancel revision error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// Get revision history for a file
router.get('/files/:fileId/revisions', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params

    // Get current file
    const { data: currentFile } = await supabaseAdmin
      .from('project_files')
      .select('project_id, file_name, parent_file_id')
      .eq('id', fileId)
      .single()

    if (!currentFile) {
      return res.status(404).json({ error: 'Dosya bulunamadı.' })
    }

    // Build the complete revision chain
    // 1. Find the root file (oldest ancestor)
    let rootFileId = fileId
    let currentCheckFile = currentFile
    
    // Go up the parent chain to find the root
    while (currentCheckFile.parent_file_id) {
      const { data: parentFile } = await supabaseAdmin
        .from('project_files')
        .select('id, parent_file_id')
        .eq('id', currentCheckFile.parent_file_id)
        .single()
      
      if (parentFile) {
        rootFileId = parentFile.id
        currentCheckFile = parentFile
      } else {
        break
      }
    }

    // 2. Get all files in the revision chain (from root to all descendants)
    // Get all files with same project and file name (regardless of is_active)
    const { data: allRevisions, error } = await supabaseAdmin
      .from('project_files')
      .select('*')
      .eq('project_id', currentFile.project_id)
      .eq('file_name', currentFile.file_name)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Get history records for all these files
    const fileIds = allRevisions?.map(f => f.id) || []
    const { data: history } = await supabaseAdmin
      .from('revision_history')
      .select(`
        *,
        changer:profiles(username, company_name)
      `)
      .in('file_id', fileIds)
      .order('changed_at', { ascending: false })

    res.json({
      revisions: allRevisions || [],
      history: history || []
    })
  } catch (error) {
    console.error('Get revision history error:', error)
    res.status(500).json({ error: 'Sunucu hatası.' })
  }
})

// =============================================
// HELPER FUNCTIONS
// =============================================

async function calculateNextRevision(currentRev) {
  const letter = currentRev.charAt(0).toUpperCase()
  if (letter === 'Z') return 'AA'
  return String.fromCharCode(letter.charCodeAt(0) + 1)
}

async function updateProjectRevision(projectId) {
  // Get highest revision from all active files
  const { data: files } = await supabaseAdmin
    .from('project_files')
    .select('revision')
    .eq('project_id', projectId)
    .eq('is_active', true)

  if (!files || files.length === 0) return

  // Find highest revision
  const revisions = files.map(f => f.revision)
  const highest = revisions.sort().pop()

  await supabaseAdmin
    .from('projects')
    .update({ current_revision: highest })
    .eq('id', projectId)
}

export default router

