/**
 * Daily data backup: Supabase (public) tablolarını JSON olarak dışa aktarır.
 * İsteğe bağlı: yedekleri R2'ye yükler.
 *
 * Kullanım:
 *   node backend/scripts/backup-data.js              # ./backups/ içine yazar
 *   node backend/scripts/backup-data.js --upload     # R2'ye de yükler
 *
 * Günlük çalıştırmak için: cron veya GitHub Actions (örn. 02:00 her gün)
 */

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(process.cwd(), '.env') })

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'kunye-project-files'

const TABLES = [
  'profiles',
  'customer_suppliers',
  'customer_users',
  'projects',
  'project_suppliers',
  'project_files',
  'quotations',
  'quotation_items',
  'documents',
  'checklist_items',
  'checklist_templates',
  'step_checklist_templates',
  'revision_requests',
  'revision_history',
  'comments'
]

const PAGE_SIZE = 1000

async function fetchTable(supabase, tableName) {
  const rows = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + PAGE_SIZE - 1)
    if (error) {
      console.error(`  ❌ ${tableName}:`, error.message)
      return null
    }
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

async function runBackup() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY .env içinde olmalı.')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const backupDir = path.join(process.cwd(), 'backups', date)
  fs.mkdirSync(backupDir, { recursive: true })
  console.log('📁 Backup klasörü:', backupDir)

  const manifest = { date, tables: {}, exportedAt: new Date().toISOString() }

  for (const table of TABLES) {
    process.stdout.write(`  ${table}...`)
    const rows = await fetchTable(supabase, table)
    if (rows === null) continue
    manifest.tables[table] = rows.length
    const filePath = path.join(backupDir, `${table}.json`)
    fs.writeFileSync(filePath, JSON.stringify(rows, null, 0), 'utf8')
    console.log(` ${rows.length} satır`)
  }

  fs.writeFileSync(
    path.join(backupDir, '_manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  )
  console.log('✅ Veritabanı yedeklendi:', backupDir)
  return { backupDir, date, manifest }
}

async function uploadToR2(backupDir, date) {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.log('⏭ R2 bilgileri yok, yükleme atlanıyor.')
    return
  }

  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY
    }
  })

  const prefix = `backups/db/${date}/`
  const files = fs.readdirSync(backupDir)
  for (const file of files) {
    const key = prefix + file
    const body = fs.readFileSync(path.join(backupDir, file))
    await client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: file.endsWith('.json') ? 'application/json' : 'application/octet-stream'
    }))
    console.log('  📤 R2:', key)
  }
  console.log('✅ R2 yükleme tamamlandı:', prefix)
}

const upload = process.argv.includes('--upload')
runBackup()
  .then(({ backupDir, date }) => upload ? uploadToR2(backupDir, date) : null)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Backup hatası:', err)
    process.exit(1)
  })
