import { NextRequest, NextResponse } from 'next/server'
import { createRole } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const actor = req.headers.get('x-user-id') || ''
  const allowed = actor ? await checkPermission(actor, 'manage_settings') : false
  if (!allowed) return NextResponse.json({ success: false, error: 'FORBIDDEN', message: 'You do not have permission to perform this action.' }, { status: 403 })
  const required = ['orgId','name','permissions']
  for (const k of required) if (body[k] === undefined || body[k] === '' || (k==='permissions' && !Array.isArray(body[k]))) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await createRole({ orgId: body.orgId, name: body.name, permissions: body.permissions })
  if (typeof res === 'string') {
    const code = res === 'ORG_NOT_FOUND' ? 404 : res === 'INVALID_PERMISSION' ? 400 : 500
    return NextResponse.json({ error: res === 'INVALID_PERMISSION' ? 'INVALID_PERMISSION_KEY' : res }, { status: code })
  }
  return NextResponse.json({ role: res })
}
import { checkPermission } from '@lib/permissions'
