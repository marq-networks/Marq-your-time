
import crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'
const SECRET = process.env.APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-secret-key-change-me'
const IV_LENGTH = 16

export function encrypt(text: string): string {
  if (!text) return ''
  // Ensure key is 32 bytes
  const key = crypto.createHash('sha256').update(String(SECRET)).digest()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

export function decrypt(text: string): string {
  if (!text) return ''
  try {
    const textParts = text.split(':')
    const iv = Buffer.from(textParts.shift()!, 'hex')
    const encryptedText = Buffer.from(textParts.join(':'), 'hex')
    const key = crypto.createHash('sha256').update(String(SECRET)).digest()
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString()
  } catch (e) {
    console.error('Decryption failed', e)
    return ''
  }
}
