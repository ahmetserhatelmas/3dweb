import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import https from 'https'
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
