import { NextRequest, NextResponse } from 'next/server'
import { listOrganizations } from '@lib/db'
import { checkPermission } from '@lib/permissions'

export async function GET(req: NextRequest) {
  const actor = req.headers.get('x-user-id') || ''
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const allowed = role === 'super_admin' ? true : (actor ? await checkPermission(actor, 'manage_org') : false)
  if (!allowed) return NextResponse.json({ success: false, error: 'FORBIDDEN', message: 'You do not have permission to perform this action.' }, { status: 403 })
  const items = await listOrganizations()
  return NextResponse.json({ items })
}
