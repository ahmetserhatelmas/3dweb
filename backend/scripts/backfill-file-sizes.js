/**
 * Backfill project_files.file_size from R2 public URL (HEAD request).
 * Run once to fix storage display for existing files.
 *
 * Usage: node backend/scripts/backfill-file-sizes.js
 * Requires: .env with SUPABASE_*, R2_PUBLIC_URL
 */

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import { fileURLToPath } from 'url'
import https from 'https'
import { URL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(process.cwd(), '.env') })

// TLS 1.2+ agent to avoid "wrong version number" with Cloudflare R2
const httpsAgent = new https.Agent({
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.3',
  rejectUnauthorized: true
})

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!R2_PUBLIC_URL) {
  console.error('Missing R2_PUBLIC_URL in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function isR2Key(p) {
  return p && typeof p === 'string' && !p.startsWith('http') && (p.startsWith('temp/') || p.startsWith('revisions/') || p.startsWith('projects/'))
}

function headRequest(urlStr) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr)
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'HEAD',
        agent: httpsAgent
      },
      (res) => {
        res.on('data', () => {})
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers }))
      }
    )
    req.on('error', reject)
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')) })
    req.end()
  })
}

async function getSizeFromR2(key, logReason = false) {
  try {
    const url = `${R2_PUBLIC_URL}/${key}`
    const { statusCode, headers } = await headRequest(url)
    const len = headers['content-length']
    if (logReason) console.log('  HEAD', statusCode, 'Content-Length:', len)
    if (statusCode !== 200) return null
    return len != null ? parseInt(len, 10) : null
  } catch (e) {
    if (logReason) console.log('  Error:', e.message)
    return null
  }
}

async function main() {
  const { data: rows, error } = await supabase
    .from('project_files')
    .select('id, file_path, file_size')
    .not('file_path', 'is', null)

  if (error) {
    console.error('Supabase error:', error.message)
    process.exit(1)
  }

  const toBackfill = (rows || []).filter((r) => isR2Key(r.file_path) && !(Number(r.file_size) > 0))
  console.log(`Found ${toBackfill.length} project_files with R2 path and missing file_size.`)

  let updated = 0
  let failed = 0
  for (let i = 0; i < toBackfill.length; i++) {
    const row = toBackfill[i]
    const logReason = i === 0
    if (logReason) console.log('Sample request for:', row.file_path)
    const size = await getSizeFromR2(row.file_path, logReason)
    if (size != null && size >= 0) {
      const { error: upErr } = await supabase.from('project_files').update({ file_size: size }).eq('id', row.id)
      if (upErr) {
        console.error('Update error', row.id, upErr.message)
        failed++
      } else {
        updated++
        if (updated % 10 === 0) console.log('Updated', updated, '...')
      }
    }
  }

  console.log('Done. Updated:', updated, 'Failed:', failed)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
