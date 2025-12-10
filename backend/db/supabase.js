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
  }
})

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

