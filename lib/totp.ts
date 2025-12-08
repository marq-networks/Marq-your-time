import crypto from 'crypto'

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  const sanitized = input.replace(/=+$/,'').toUpperCase()
  for (const c of sanitized) {
    const val = alphabet.indexOf(c)
    if (val < 0) continue
    bits += val.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

export function generateTotpSecret(length = 20): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let out = ''
  const buf = crypto.randomBytes(length)
  for (let i = 0; i < buf.length; i++) out += alphabet[buf[i] % alphabet.length]
  return out
}

export function totpToken(secret: string, stepSeconds = 30, digits = 6, timeMs?: number): string {
  const key = base32Decode(secret)
  let counter = Math.floor(((timeMs ?? Date.now()) / 1000) / stepSeconds)
  const msg = Buffer.alloc(8)
  for (let i = 7; i >= 0; i--) { msg[i] = counter & 0xff; counter >>>= 8 }
  const hmac = crypto.createHmac('sha1', key).update(msg).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff)
  const otp = code % (10 ** digits)
  return otp.toString().padStart(digits, '0')
}

export function verifyTotp(input: string, secret: string, window = 1, stepSeconds = 30, digits = 6): boolean {
  const now = Date.now()
  for (let w = -window; w <= window; w++) {
    const t = now + (w * stepSeconds * 1000)
    if (totpToken(secret, stepSeconds, digits, t) === input) return true
  }
  return false
}

export function buildOtpauthUri(secret: string, accountName: string, issuer = 'MARQ'): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`)
  const params = new URLSearchParams({ secret, issuer, period: '30', digits: '6', algorithm: 'SHA1' })
  return `otpauth://totp/${label}?${params.toString()}`
}
