import { NextRequest, NextResponse } from 'next/server'
import { activateUser } from '@lib/db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = req.headers.get('x-user-id') || ''
  const allowed = actor ? await checkPermission(actor, 'manage_users') : false
  if (!allowed) return NextResponse.json({ success: false, error: 'FORBIDDEN', message: 'You do not have permission to perform this action.' }, { status: 403 })
  const res = await activateUser(params.id)
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 404 })
  return NextResponse.json({ user: res })
}
import { checkPermission } from '@lib/permissions'
