import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getUser, updateUserPassword } from '@lib/db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { currentPassword, newPassword } = body
  const actor = req.headers.get('x-user-id') || ''
  
  if (!actor) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (actor !== params.id) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  
  if (!currentPassword || !newPassword) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })

  const user: any = await getUser(params.id)
  if (!user) return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 })

  const inputHash = crypto.createHash('sha256').update(currentPassword).digest('hex')
  const ok = !!user.passwordHash && (user.passwordHash.length === 64 ? user.passwordHash === inputHash : user.passwordHash === currentPassword)
  
  if (!ok) return NextResponse.json({ error: 'INVALID_PASSWORD' }, { status: 400 })

  const newHash = crypto.createHash('sha256').update(newPassword).digest('hex')
  const res = await updateUserPassword(params.id, newHash)
  
  if (res === 'DB_ERROR') return NextResponse.json({ error: res }, { status: 500 })
  if (!res) return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 })
  
  return NextResponse.json({ success: true })
}
