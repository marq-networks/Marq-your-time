import { NextRequest, NextResponse } from 'next/server'
import { listSupportTickets } from '@lib/db'

function allow(role: string) { return ['admin','owner','hr','it','super_admin'].includes(role.toLowerCase()) }

export async function GET(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!allow(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const url = new URL(req.url)
  const org_id = url.searchParams.get('org_id') || url.searchParams.get('orgId') || ''
  const status = url.searchParams.get('status') || undefined
  const category = url.searchParams.get('category') || undefined
  if (!org_id) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  const items = await listSupportTickets({ orgId: org_id, status: status || undefined, category: category || undefined })
  return NextResponse.json({ items })
}

