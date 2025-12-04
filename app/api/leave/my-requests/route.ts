import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listMyRequests as memListMyRequests } from '@lib/memory/leave'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const member_id = searchParams.get('member_id') || searchParams.get('memberId') || ''
  if (!member_id) return NextResponse.json({ error: 'MISSING_MEMBER' }, { status: 400 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) {
    const items = memListMyRequests(member_id)
    return NextResponse.json({ items })
  }
  const { data } = await sb.from('leave_requests').select('*, leave_types(code, name)').eq('member_id', member_id).order('created_at', { ascending: false })
  const items = (data||[]).map((r:any)=> ({ id: r.id, org_id: r.org_id, member_id: r.member_id, leave_type_id: r.leave_type_id, type_code: r.leave_types?.code, type_name: r.leave_types?.name, start_date: r.start_date, end_date: r.end_date, days_count: Number(r.days_count||0), status: r.status, reason: r.reason||'', created_at: r.created_at, reviewed_at: r.reviewed_at, review_note: r.review_note||'' }))
  return NextResponse.json({ items })
}
