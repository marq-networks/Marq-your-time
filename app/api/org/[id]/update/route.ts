import { NextRequest, NextResponse } from 'next/server'
import { updateOrganization } from '@lib/db'
import { checkPermission } from '@lib/permissions'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = req.headers.get('x-user-id') || ''
  const allowed = actor ? await checkPermission(actor, 'manage_org') : false
  if (!allowed) return NextResponse.json({ success: false, error: 'FORBIDDEN', message: 'You do not have permission to perform this action.' }, { status: 403 })
  const body = await req.json()
  const res = await updateOrganization(params.id, body)
  if (res === 'SEAT_LIMIT_BELOW_USED') return NextResponse.json({ error: res }, { status: 400 })
  if (!res) return NextResponse.json({ error: 'ORG_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ org: res })
}
