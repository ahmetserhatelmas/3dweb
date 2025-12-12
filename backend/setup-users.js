import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createUser(email, password, username, role, companyName) {
  console.log(`Creating ${role}: ${email}...`)
  
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      username,
      role,
      company_name: companyName
    }
  })

  if (error) {
    if (error.message.includes('already been registered')) {
      console.log(`  ⚠️  User ${email} already exists, skipping...`)
      return null
    }
    console.error(`  ❌ Error: ${error.message}`)
    return null
  }

  console.log(`  ✅ Created: ${data.user.id}`)
  return data.user
}

async function main() {
  console.log('🚀 Setting up M-Chain users...\n')

  // Create Admin
  await createUser(
    'admin@mchain.com',
    'admin123',
    'admin',
    'admin',
    'TUSAŞ Mühendislik'
  )

  // Create Supplier 1
  await createUser(
    'tedarikci@mchain.com',
    'user123',
    'tedarikci',
    'user',
    'ABC Makina Ltd.'
  )

  // Create Supplier 2
  await createUser(
    'tedarikci2@mchain.com',
    'user123',
    'tedarikci2',
    'user',
    'XYZ Parça A.Ş.'
  )

  console.log('\n✅ Setup complete!')
  console.log('\n🔑 Login Credentials:')
  console.log('   Admin:      admin@mchain.com / admin123')
  console.log('   Tedarikci:  tedarikci@mchain.com / user123')
  console.log('   Tedarikci2: tedarikci2@mchain.com / user123')
}

main().catch(console.error)






