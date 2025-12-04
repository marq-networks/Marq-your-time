import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { authenticatePublicApi, hasScope } from '@lib/public/auth'

export async function GET(req: NextRequest) {
  const client = await authenticatePublicApi(req)
  if (!client) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!hasScope(client.scopes, 'read:payroll')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'SUPABASE_REQUIRED' }, { status: 400 })
  const { searchParams } = new URL(req.url)
  const pid = searchParams.get('payroll_period_id') || ''
  const date_start = searchParams.get('date_start') || ''
  const date_end = searchParams.get('date_end') || ''
  let rows: any[] = []
  if (pid) {
    const { data } = await sb.from('member_payroll').select('*').eq('payroll_period_id', pid)
    rows = data || []
  } else if (date_start && date_end) {
    const { data: periods } = await sb.from('payroll_periods_v12').select('id').eq('org_id', client.orgId).lte('period_start', date_end).gte('period_end', date_start)
    const ids = (periods || []).map((p: any) => p.id)
    if (ids.length) {
      const { data } = await sb.from('member_payroll').select('*').in('payroll_period_id', ids)
      rows = data || []
    }
  } else {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  }
  const items = rows.map((r: any) => ({
    member_id: r.member_id,
    base_salary: Number(r.base_salary || 0),
    worked_minutes: Number(r.worked_minutes || 0),
    overtime_amount: Number(r.overtime_amount || 0),
    short_deduction: Number(r.short_deduction || 0),
    fines_total: Number(r.fines_total || 0),
    adjustments_total: Number(r.adjustments_total || 0),
    net_salary: Number(r.net_salary || 0)
  }))
  return NextResponse.json({ items })
}
