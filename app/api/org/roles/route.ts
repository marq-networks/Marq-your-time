import { NextRequest, NextResponse } from 'next/server'
import { listMemberRoles, createMemberRole } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const org_id = searchParams.get('org_id') || searchParams.get('orgId') || ''
  if (!org_id) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  const items = await listMemberRoles(org_id)
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>({}))
  const org_id = body.org_id || body.orgId
  const name = body.name
  const level = Number(body.level || 0)
  if (!org_id || !name || !level) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await createMemberRole({ orgId: org_id, name, level })
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: res === 'DB_ERROR' ? 500 : 400 })
  return NextResponse.json({ role: res })
}

