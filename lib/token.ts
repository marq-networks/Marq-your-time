import crypto from 'crypto'
export function newId() { return crypto.randomUUID() }
export function newToken() { return crypto.randomBytes(24).toString('hex') }
