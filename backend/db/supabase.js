import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file')
  console.log('Please create a .env file with:')
  console.log('  SUPABASE_URL=your-project-url')
  console.log('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key')
}

// Admin client with service role (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-my-custom-header': 'supabase-admin-client'
    }
  }
})

// Test connection on startup
const testConnection = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('projects')
      .select('id, name')
      .limit(3)
    
    if (error) {
      console.error('❌ Supabase connection test FAILED:', error.message)
    } else {
      console.log('✅ Supabase connection OK - Found', data?.length, 'projects')
      console.log('Sample:', data?.map(p => p.name))
    }
  } catch (e) {
    console.error('❌ Supabase connection error:', e.message)
  }
}

// Run test after a short delay
setTimeout(testConnection, 1000)

// Create client for specific user (respects RLS)
export const createUserClient = (accessToken) => {
  return createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  })
}

export default supabaseAdmin






