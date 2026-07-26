import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 64
const TAG_LENGTH = 16

/**
 * Derives a secure key from the ENCRYPTION_KEY environment variable.
 */
function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || 'development-fallback-secret-key-32-bytes-long'
  return crypto.scryptSync(secret, 'salt', 32)
}

export function encrypt(text: string): string {
  if (!text) return text

  const iv = crypto.randomBytes(IV_LENGTH)
  const salt = crypto.randomBytes(SALT_LENGTH)
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'development-fallback-secret-key-32-bytes-long', salt, 32)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const tag = cipher.getAuthTag()

  // Format: iv:salt:tag:encryptedText
  return `${iv.toString('hex')}:${salt.toString('hex')}:${tag.toString('hex')}:${encrypted}`
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText

  const parts = encryptedText.split(':')
  if (parts.length !== 4) throw new Error('Invalid encrypted text format')

  const [ivHex, saltHex, tagHex, encryptedHex] = parts
  
  const iv = Buffer.from(ivHex, 'hex')
  const salt = Buffer.from(saltHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'development-fallback-secret-key-32-bytes-long', salt, 32)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
