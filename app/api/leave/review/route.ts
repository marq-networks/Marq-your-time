import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { reviewRequest as memReviewRequest } from '@lib/memory/leave'
import { queueWebhookEvent } from '@lib/webhooks/queue'
import { applyLeaveToDailySummaries } from '@lib/db'
import { createHRLog } from '@lib/hr-log'

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (role !== 'super_admin' && role !== 'org_admin' && role !== 'manager') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  const body = await req.json().catch(()=>({}))
  const request_id = body.request_id || body.id
  const status = body.status
  const note = body.note || ''
  if (!request_id || !status || !['approved','rejected'].includes(status)) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const reviewed_by = req.headers.get('x-user-id') || null
  const reviewed_at = new Date()
  if (!sb) {
    const item = memReviewRequest(request_id, status, note, reviewed_by || undefined)
    if (!item) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    try { const ev = status==='approved'?'leave.request_approved':'leave.request_rejected'; await queueWebhookEvent(String(item.org_id), ev, { id: item.id, org_id: String(item.org_id), member_id: String(item.member_id), status }) } catch {}
    return NextResponse.json({ item })
  }
  const { data: existing } = await sb.from('leave_requests').select('*').eq('id', request_id).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  
  const oldStatus = existing.status
  
  if (existing.status === status) {
    const { data } = await sb.from('leave_requests').update({ review_note: note, reviewed_by, reviewed_at }).eq('id', request_id).select('*').single()
    if (!data) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
    
    if (reviewed_by && note !== existing.review_note) {
       await createHRLog({
          org_id: data.org_id,
          actor_user_id: reviewed_by,
          actor_role: role,
          employee_user_id: data.member_id,
          module: 'pto',
          entity_table: 'leave_requests',
          entity_id: data.id,
          field_name: 'review_note',
          old_value: existing.review_note,
          new_value: note,
          reason: 'Review note updated by admin'
       })
    }

    try { const ev = status==='approved'?'leave.request_approved':'leave.request_rejected'; await queueWebhookEvent(String(data.org_id), ev, { id: data.id, org_id: String(data.org_id), member_id: String(data.member_id), status }) } catch {}
    return NextResponse.json({ item: data })
  }
  const { data, error } = await sb.from('leave_requests').update({ status, review_note: note, reviewed_by, reviewed_at }).eq('id', request_id).select('*').single()
  if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  
  const logReason = (note && note.length >= 8) ? note : `Leave request ${status} by admin`

  // LOG HR ADJUSTMENT
  if (reviewed_by) {
    await createHRLog({
      org_id: data.org_id,
      actor_user_id: reviewed_by,
      actor_role: role,
      employee_user_id: data.member_id,
      module: 'pto',
      entity_table: 'leave_requests',
      entity_id: data.id,
      field_name: 'status',
      old_value: { status: oldStatus },
      new_value: { status: status },
      reason: logReason
    })
  }

  if (status === 'approved') {
    const { data: typeRow } = await sb.from('leave_types').select('*').eq('id', data.leave_type_id).eq('org_id', data.org_id).maybeSingle()
    if (typeRow && typeRow.paid) {
      const allowNegative = !!typeRow.allow_negative
      const days = Number(data.days_count || 0)
      const { data: balanceRow } = await sb.from('employee_leave_balance').select('*').eq('user_id', data.member_id).eq('leave_type_id', data.leave_type_id).maybeSingle()
      let currentBalance = balanceRow ? Number(balanceRow.balance || 0) : Number(typeRow.default_days_per_year || 0)
      let balanceId = balanceRow?.id
      if (!balanceRow) {
        const { data: newBal, error: insErr } = await sb.from('employee_leave_balance').insert({ user_id: data.member_id, leave_type_id: data.leave_type_id, balance: currentBalance }).select('id').single()
        if (insErr) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
        balanceId = newBal.id
      }
      const nextBalance = currentBalance - days
      if (!allowNegative && nextBalance < 0) return NextResponse.json({ error: 'INSUFFICIENT_BALANCE', item: data }, { status: 400 })
      const { error: updErr } = await sb.from('employee_leave_balance').update({ balance: nextBalance }).eq('user_id', data.member_id).eq('leave_type_id', data.leave_type_id)
      if (updErr) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
      
      // LOG BALANCE ADJUSTMENT
      if (reviewed_by) {
         await createHRLog({
          org_id: data.org_id,
          actor_user_id: reviewed_by,
          actor_role: role,
          employee_user_id: data.member_id,
          module: 'pto',
          entity_table: 'employee_leave_balance',
          entity_id: balanceId,
          field_name: 'balance',
          old_value: { balance: currentBalance },
          new_value: { balance: nextBalance },
          reason: `Balance deduction for approved leave: ${logReason}`
        })
      }
    }
    const paid = !!(typeRow && typeRow.paid)
    await applyLeaveToDailySummaries(String(data.member_id), String(data.org_id), String(data.start_date), String(data.end_date), paid)
  }
  try { const ev = status==='approved'?'leave.request_approved':'leave.request_rejected'; await queueWebhookEvent(String(data.org_id), ev, { id: data.id, org_id: String(data.org_id), member_id: String(data.member_id), status }) } catch {}
  return NextResponse.json({ item: data })
}
