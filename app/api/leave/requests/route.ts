import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listRequests as memListRequests } from '@lib/memory/leave'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const org_id = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const status = searchParams.get('status') || undefined
  const member_id = searchParams.get('member_id') || searchParams.get('memberId') || undefined
  const start_date = searchParams.get('start_date') || searchParams.get('startDate') || undefined
  const end_date = searchParams.get('end_date') || searchParams.get('endDate') || undefined
  if (!org_id) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) {
    const items = memListRequests({ org_id, status: status || undefined, member_id: member_id || undefined, start_date: start_date || undefined, end_date: end_date || undefined })
    return NextResponse.json({ items })
  }
  let q = sb.from('leave_requests').select('*, leave_types(code, name)').eq('org_id', org_id)
  if (status) q = q.eq('status', status)
  if (member_id) q = q.eq('member_id', member_id)
  if (start_date && end_date) q = q.gte('start_date', start_date).lte('end_date', end_date)
  const { data } = await q.order('created_at', { ascending: false })
  const items = (data||[]).map((r:any)=> ({ id: r.id, org_id: r.org_id, member_id: r.member_id, leave_type_id: r.leave_type_id, type_code: r.leave_types?.code, type_name: r.leave_types?.name, start_date: r.start_date, end_date: r.end_date, days_count: Number(r.days_count||0), status: r.status, reason: r.reason||'', created_at: r.created_at, reviewed_at: r.reviewed_at, review_note: r.review_note||'' }))
  return NextResponse.json({ items })
}
