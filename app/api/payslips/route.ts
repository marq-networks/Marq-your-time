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

  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '50')
  const q = searchParams.get('q') || ''
  const sort = searchParams.get('sort') || ''
  const userIds = searchParams.get('userIds') ? searchParams.get('userIds')?.split(',') : undefined
  const statusParam = searchParams.get('status') || undefined

  // status param isn't fully supported in listPayslips yet aside from implicit 'mode'.
  // But listPayslips returns what is available.
  
  const res = await listPayslips(orgId, period, { page, pageSize, q, sort, userIds, status: statusParam })
  
  if ('error' in res) return NextResponse.json(res, { status: 400 })
  
  return NextResponse.json(res)
}
