import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import https from 'https'
import http from 'http'
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

// Create custom HTTPS agent with legacy SSL support
const customAgent = new https.Agent({
  rejectUnauthorized: false,
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.3',
  // Try all available ciphers
  ciphers: [
    'TLS_AES_128_GCM_SHA256',
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES256-GCM-SHA384'
  ].join(':'),
  honorCipherOrder: true,
  secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
})

// Initialize S3 client with custom handler
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: false,
  requestHandler: new NodeHttpHandler({
    httpsAgent: customAgent,
    connectionTimeout: 30000,
    requestTimeout: 60000
  })
})

/**
 * Upload a file to R2 using AWS SDK
 */
export async function uploadToR2(buffer, key, contentType = 'application/octet-stream') {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType
    })
    
    await s3Client.send(command)
    
    const fileUrl = PUBLIC_URL ? `${PUBLIC_URL}/${key}` : `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET_NAME}/${key}`
    
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
 * Get object size from R2 (bytes). Uses public URL HEAD to avoid SDK SSL issues.
 * Returns null if not found or error.
 */
export async function getR2ObjectSize(key) {
  if (!key || typeof key !== 'string') return null
  const publicUrl = PUBLIC_URL ? `${PUBLIC_URL.replace(/\/$/, '')}/${key}` : null
  if (publicUrl) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(publicUrl, { method: 'HEAD', signal: controller.signal })
      clearTimeout(timeoutId)
      if (!res.ok) return null
      const len = res.headers.get('content-length')
      if (len != null) return parseInt(len, 10)
      return null
    } catch {
      return null
    }
  }
  try {
    const command = new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key })
    const response = await s3Client.send(command)
    return response.ContentLength != null ? Number(response.ContentLength) : null
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) return null
    return null
  }
}

/**
 * Stream a file from R2 by key. Returns { body, contentType, contentLength } or null if not found.
 * Uses public URL with Node https/http + custom agent to avoid SSL handshake errors (EPROTO / wrong version).
 */
export async function getR2ObjectStream(key) {
  if (!key || typeof key !== 'string') return null
  const publicUrl = PUBLIC_URL ? `${PUBLIC_URL.replace(/\/$/, '')}/${key}` : null

  if (publicUrl) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(publicUrl)
      const isHttps = urlObj.protocol === 'https:'
      const lib = isHttps ? https : http
      const opts = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        ...(isHttps && { agent: customAgent })
      }
      const req = lib.request(opts, (res) => {
        if (res.statusCode !== 200) {
          res.resume()
          reject(new Error(`R2 public URL returned ${res.statusCode}`))
          return
        }
        const contentType = res.headers['content-type'] || 'application/octet-stream'
        const contentLength = res.headers['content-length']
        resolve({
          body: res,
          contentType,
          contentLength: contentLength != null ? parseInt(contentLength, 10) : null
        })
      })
      req.on('error', reject)
      req.setTimeout(60000, () => {
        req.destroy(new Error('R2 public URL timeout'))
      })
      req.end()
    })
  }

  try {
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key })
    const response = await s3Client.send(command)
    return {
      body: response.Body,
      contentType: response.ContentType || 'application/octet-stream',
      contentLength: response.ContentLength
    }
  } catch (error) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) return null
    console.error('R2 getObject error:', error)
    throw error
  }
}

/**
 * Delete a file from R2
 */
export async function deleteFromR2(key) {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    })
    
    await s3Client.send(command)
  } catch (error) {
    console.error('R2 delete error:', error)
    throw error
  }
}

/**
 * Generate a presigned URL for client-side upload (bypasses backend TLS issues)
 */
export function generatePresignedUploadUrl(key, contentType, expiresInSeconds = 900) {
  try {
    const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET_NAME}/${key}`
    const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    
    const now = new Date()
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const shortDate = amzDate.slice(0, 8)
    
    const credential = `${R2_ACCESS_KEY_ID}/${shortDate}/auto/s3/aws4_request`
    
    const canonicalQueryString = [
      `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
      `X-Amz-Credential=${encodeURIComponent(credential)}`,
      `X-Amz-Date=${amzDate}`,
      `X-Amz-Expires=${expiresInSeconds}`,
      `X-Amz-SignedHeaders=host`
    ].join('&')
    
    const canonicalRequest = [
      'PUT',
      `/${BUCKET_NAME}/${key}`,
      canonicalQueryString,
      `host:${host}`,
      '',
      'host',
      'UNSIGNED-PAYLOAD'
    ].join('\n')
    
    const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      `${shortDate}/auto/s3/aws4_request`,
      canonicalRequestHash
    ].join('\n')
    
    const signature = createSignature(stringToSign, R2_SECRET_ACCESS_KEY, shortDate)
    
    const presignedUrl = `${url}?${canonicalQueryString}&X-Amz-Signature=${signature}`
    
    const publicUrl = PUBLIC_URL ? `${PUBLIC_URL}/${key}` : `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET_NAME}/${key}`
    
    return {
      uploadUrl: presignedUrl,
      publicUrl: publicUrl,
      key: key
    }
  } catch (error) {
    console.error('Presigned URL generation error:', error)
    throw error
  }
}

/**
 * AWS Signature V4 signing helper
 */
function createSignature(stringToSign, secretKey, shortDate) {
  const kDate = crypto.createHmac('sha256', 'AWS4' + secretKey).update(shortDate).digest()
  const kRegion = crypto.createHmac('sha256', kDate).update('auto').digest()
  const kService = crypto.createHmac('sha256', kRegion).update('s3').digest()
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest()
  return crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex')
}

export function generateR2Key(projectId, filename) {
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(2, 8)
  const ext = filename.substring(filename.lastIndexOf('.'))
  return `projects/${projectId}/${timestamp}-${randomStr}${ext}`
}
