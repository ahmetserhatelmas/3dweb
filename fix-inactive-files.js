import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixInactiveFiles() {
  console.log('Checking all project files...\n')
  
  // Get all project files
  const { data: allFiles, error } = await supabase
    .from('project_files')
    .select('*')
    .order('file_name')
    .order('revision')
  
  if (error) {
    console.error('Error fetching files:', error)
    return
  }
  
  console.log(`Found ${allFiles.length} files total\n`)
  
  // Group by file_name
  const fileGroups = {}
  allFiles.forEach(file => {
    const key = `${file.project_id}-${file.file_name}`
    if (!fileGroups[key]) {
      fileGroups[key] = []
    }
    fileGroups[key].push(file)
  })
  
  // For each group, mark all but the latest revision as inactive
  for (const [key, files] of Object.entries(fileGroups)) {
    if (files.length > 1) {
      console.log(`\n📁 ${files[0].file_name} (${files.length} revisions)`)
      
      // Sort by revision letter (A, B, C, etc.)
      files.sort((a, b) => (a.revision || 'A').localeCompare(b.revision || 'A'))
      
      // Mark all except the last one as inactive
      for (let i = 0; i < files.length - 1; i++) {
        const file = files[i]
        console.log(`  ❌ Rev. ${file.revision} (ID: ${file.id}) -> Setting is_active = false`)
        
        const { error: updateError } = await supabase
          .from('project_files')
          .update({ is_active: false })
          .eq('id', file.id)
        
        if (updateError) {
          console.error(`     Error updating: ${updateError.message}`)
        } else {
          console.log(`     ✅ Updated successfully`)
        }
      }
      
      // Ensure the latest is active
      const latestFile = files[files.length - 1]
      console.log(`  ✅ Rev. ${latestFile.revision} (ID: ${latestFile.id}) -> Keeping is_active = true`)
      
      const { error: updateError } = await supabase
        .from('project_files')
        .update({ is_active: true })
        .eq('id', latestFile.id)
      
      if (updateError) {
        console.error(`     Error updating: ${updateError.message}`)
      }
    } else {
      // Single file, ensure it's active
      const file = files[0]
      if (file.is_active !== true) {
        console.log(`\n📁 ${file.file_name} - Single file, setting is_active = true`)
        await supabase
          .from('project_files')
          .update({ is_active: true })
          .eq('id', file.id)
      }
    }
  }
  
  console.log('\n✅ Done! Refresh your browser to see the changes.')
}

fixInactiveFiles().catch(console.error)

