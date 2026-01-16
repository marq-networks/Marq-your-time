import { NextRequest } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { resolvePayrollPeriod } from '@lib/payslips'

function allow(role: string) {
  const r = role.toLowerCase()
  return ['admin', 'manager', 'finance', 'owner', 'super_admin'].includes(r)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || ''
  let orgId = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!allow(role)) return new Response(JSON.stringify({ error: 'FORBIDDEN' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  if (!orgId) orgId = req.headers.get('x-org-id') || ''
  if (!orgId || !period) return new Response(JSON.stringify({ error: 'MISSING_FIELDS' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return new Response(JSON.stringify({ error: 'SUPABASE_REQUIRED' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  const p = await resolvePayrollPeriod(orgId, period)
  if (!p) return new Response(JSON.stringify({ error: 'PERIOD_NOT_FOUND' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
  const { data: rows } = await sb.from('member_payroll').select('*').eq('payroll_period_id', p.id)
  const headers = ['MemberId','BaseSalary','WorkedMinutes','ExtraMinutes','ShortMinutes','OvertimeAmount','ShortDeduction','FinesTotal','AdjustmentsTotal','NetSalary']
  const lines = [headers.join(',')].concat((rows || []).map((r: any) => [
    r.member_id,
    r.base_salary,
    r.worked_minutes,
    r.extra_minutes,
    r.short_minutes,
    r.overtime_amount,
    r.short_deduction,
    r.fines_total,
    r.adjustments_total,
    r.net_salary
  ].join(',')))
  const content = lines.join('\n')
  const filename = `payslips_${period || p.id}.csv`
  return new Response(content, { status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename=${filename}` } })
}

