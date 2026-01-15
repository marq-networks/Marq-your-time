import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { addRequest as memAddRequest } from '@lib/memory/leave'
import { queueWebhookEvent } from '@lib/webhooks/queue'

function daysBetween(start: string, end: string) { const s = new Date(start + 'T00:00:00Z'); const e = new Date(end + 'T00:00:00Z'); return Math.max(1, Math.round((e.getTime()-s.getTime())/(24*60*60*1000))+1) }

export async function POST(req: NextRequest) {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  const body = await req.json().catch(()=>({}))
  const org_id = body.org_id || body.orgId
  const member_id = body.member_id || body.memberId
  const leave_type_id = body.leave_type_id || body.leaveTypeId
  const start_date = body.start_date || body.startDate
  const end_date = body.end_date || body.endDate
  const reason = body.reason || ''
  if (!org_id || !member_id || !leave_type_id || !start_date || !end_date) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const days_count = daysBetween(start_date, end_date)
  const now = new Date()
  const created_by = req.headers.get('x-user-id') || null
  if (!sb) {
    const item = memAddRequest({ org_id, member_id, leave_type_id, start_date, end_date, reason, created_by: created_by || undefined })
    try { await queueWebhookEvent(org_id, 'leave.request_created', { id: item.id, org_id, member_id, leave_type_id, start_date, end_date, days_count: item.days_count }) } catch {}
    return NextResponse.json({ item })
  }
  const { data: typeRow } = await sb.from('leave_types').select('*').eq('id', leave_type_id).eq('org_id', org_id).maybeSingle()
  if (!typeRow) return NextResponse.json({ error: 'INVALID_TYPE' }, { status: 400 })
  if (typeRow.paid) {
    const allowNegative = !!typeRow.allow_negative
    const { data: balanceRow } = await sb.from('employee_leave_balance').select('*').eq('user_id', member_id).eq('leave_type_id', leave_type_id).maybeSingle()
    let currentBalance = balanceRow ? Number(balanceRow.balance || 0) : Number(typeRow.default_days_per_year || 0)
    if (!balanceRow) {
      const { error: insErr } = await sb.from('employee_leave_balance').insert({ user_id: member_id, leave_type_id, balance: currentBalance })
      if (insErr) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
    }
    if (!allowNegative && currentBalance < days_count) return NextResponse.json({ error: 'INSUFFICIENT_BALANCE' }, { status: 400 })
  }
  const { data, error } = await sb.from('leave_requests').insert({ org_id, member_id, leave_type_id, start_date, end_date, days_count, status: 'pending', reason, created_at: now, created_by }).select('*').single()
  if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  try { await queueWebhookEvent(org_id, 'leave.request_created', { id: data.id, org_id, member_id, leave_type_id, start_date, end_date, days_count }) } catch {}
  return NextResponse.json({ item: data })
}
