import { NextRequest, NextResponse } from 'next/server'
import { listUserOrganizations } from '@lib/db'

export async function POST(req: NextRequest) {
  const actor = req.headers.get('x-user-id') || ''
  if (!actor) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const body = await req.json().catch(()=>null)
  const orgId = body?.orgId || body?.org_id || ''
  if (!orgId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const orgs = await listUserOrganizations(actor)
  if (!orgs.some(o => o.id === orgId)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const res = NextResponse.json({ success: true, current_org_id: orgId })
  res.cookies.set('current_org_id', orgId, { path: '/', sameSite: 'lax' })
  return res
}

