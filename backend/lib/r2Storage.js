import crypto from 'crypto'

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'kunye-project-files'
const PUBLIC_URL = process.env.R2_PUBLIC_URL

console.log('🪣 R2 Configuration:', {
  bucket: BUCKET_NAME,
  publicUrl: PUBLIC_URL,
  accountId: R2_ACCOUNT_ID?.substring(0, 8) + '...',
  hasAccessKey: !!R2_ACCESS_KEY_ID,
  hasSecretKey: !!R2_SECRET_ACCESS_KEY
})

/**
 * AWS Signature V4 signing
 */
function createSignature(stringToSign, secretKey, shortDate) {
  const kDate = crypto.createHmac('sha256', 'AWS4' + secretKey).update(shortDate).digest()
  const kRegion = crypto.createHmac('sha256', kDate).update('auto').digest()
  const kService = crypto.createHmac('sha256', kRegion).update('s3').digest()
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest()
  return crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex')
}

/**
 * Upload a file to R2 using native fetch + AWS Signature V4
 */
export async function uploadToR2(buffer, key, contentType = 'application/octet-stream') {
  try {
    const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET_NAME}/${key}`
    const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    
    const now = new Date()
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const shortDate = amzDate.slice(0, 8)
    
    const payloadHash = crypto.createHash('sha256').update(buffer).digest('hex')
    
    const canonicalRequest = [
      'PUT',
      `/${BUCKET_NAME}/${key}`,
      '',
      `content-type:${contentType}`,
      `host:${host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`,
      '',
      'content-type;host;x-amz-content-sha256;x-amz-date',
      payloadHash
    ].join('\n')
    
    const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      `${shortDate}/auto/s3/aws4_request`,
      canonicalRequestHash
    ].join('\n')
    
    const signature = createSignature(stringToSign, R2_SECRET_ACCESS_KEY, shortDate)
    
    const authorization = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${shortDate}/auto/s3/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=${signature}`
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Host': host,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        'Authorization': authorization
      },
      body: buffer
    })
    
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`R2 upload failed: ${response.status} ${text}`)
    }
    
    const fileUrl = PUBLIC_URL ? `${PUBLIC_URL}/${key}` : url
    
    return { url: fileUrl, key }
  } catch (error) {
    console.error('R2 upload error:', error)
    throw error
  }
}

/**
 * Get a signed URL for private file access
 */
export async function getSignedR2Url(key, expiresIn = 3600) {
  const url = PUBLIC_URL ? `${PUBLIC_URL}/${key}` : `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET_NAME}/${key}`
  return url
}

/**
 * Delete a file from R2
 */
export async function deleteFromR2(key) {
  try {
    const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET_NAME}/${key}`
    const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    
    const now = new Date()
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const shortDate = amzDate.slice(0, 8)
    
    const payloadHash = crypto.createHash('sha256').update('').digest('hex')
    
    const canonicalRequest = [
      'DELETE',
      `/${BUCKET_NAME}/${key}`,
      '',
      `host:${host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`,
      '',
      'host;x-amz-content-sha256;x-amz-date',
      payloadHash
    ].join('\n')
    
    const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      `${shortDate}/auto/s3/aws4_request`,
      canonicalRequestHash
    ].join('\n')
    
    const signature = createSignature(stringToSign, R2_SECRET_ACCESS_KEY, shortDate)
    
    const authorization = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${shortDate}/auto/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${signature}`
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Host': host,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        'Authorization': authorization
      }
    })
    
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`R2 delete failed: ${response.status} ${text}`)
    }
  } catch (error) {
    console.error('R2 delete error:', error)
    throw error
  }
}

export function generateR2Key(projectId, filename) {
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(2, 8)
  const ext = filename.substring(filename.lastIndexOf('.'))
  return `projects/${projectId}/${timestamp}-${randomStr}${ext}`
}
