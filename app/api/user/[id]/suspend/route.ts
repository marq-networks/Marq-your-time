import { NextRequest, NextResponse } from 'next/server'
import { suspendUser } from '@lib/db'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const req = arguments[0] as NextRequest
  const actor = (req as any).headers?.get('x-user-id') || ''
  const allowed = actor ? await checkPermission(actor, 'manage_users') : false
  if (!allowed) return NextResponse.json({ success: false, error: 'FORBIDDEN', message: 'You do not have permission to perform this action.' }, { status: 403 })
  const res = await suspendUser(params.id)
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 404 })
  return NextResponse.json({ user: res })
}
import { checkPermission } from '@lib/permissions'
