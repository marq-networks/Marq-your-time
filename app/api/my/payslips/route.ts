import { NextRequest, NextResponse } from 'next/server'
import { listPayslips } from '@lib/payslips'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || ''
  const orgIdParam = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const cookieOrgId = req.cookies.get('current_org_id')?.value || ''
  const memberIdParam = searchParams.get('member_id') || searchParams.get('memberId') || ''
  const cookieMemberId = req.cookies.get('current_user_id')?.value || ''
  const headerRole = (req.headers.get('x-role') || '').toLowerCase()
  const cookieRole = (req.cookies.get('current_role')?.value || '').toLowerCase()
  const role = headerRole || cookieRole
  if (!['employee', 'member'].includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const orgId = orgIdParam || cookieOrgId
  const memberId = memberIdParam || cookieMemberId
  if (!orgId || !memberId || !period) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await listPayslips(orgId, period)
  if (!Array.isArray(res)) return NextResponse.json(res, { status: 400 })
  const items = res.filter(p => p.userId === memberId)
  return NextResponse.json({ items })
}

