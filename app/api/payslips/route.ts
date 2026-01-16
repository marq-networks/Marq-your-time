import { NextRequest, NextResponse } from 'next/server'
import { listPayslips } from '@lib/payslips'

function allow(role: string) {
  const r = role.toLowerCase()
  return ['admin', 'manager', 'finance', 'owner', 'super_admin'].includes(r)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || ''
  let orgId = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!allow(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  if (!orgId) orgId = req.headers.get('x-org-id') || ''
  if (!orgId || !period) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await listPayslips(orgId, period)
  if (!Array.isArray(res)) return NextResponse.json(res, { status: 400 })
  return NextResponse.json({ items: res })
}

