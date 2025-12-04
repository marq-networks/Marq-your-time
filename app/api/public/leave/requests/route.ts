import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { authenticatePublicApi, hasScope } from '@lib/public/auth'

export async function GET(req: NextRequest) {
  const client = await authenticatePublicApi(req)
  if (!client) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!hasScope(client.scopes, 'read:leave')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'SUPABASE_REQUIRED' }, { status: 400 })
  const { searchParams } = new URL(req.url)
  const date_start = searchParams.get('date_start') || ''
  const date_end = searchParams.get('date_end') || ''
  const status = searchParams.get('status') || ''
  const member_id = searchParams.get('member_id') || ''
  let q = sb.from('leave_requests').select('*').eq('org_id', client.orgId)
  if (date_start && date_end) q = q.lte('start_date', date_end).gte('end_date', date_start)
  if (status) q = q.eq('status', status)
  if (member_id) q = q.eq('member_id', member_id)
  const { data: rows } = await q.order('start_date', { ascending: false })
  const { data: types } = await sb.from('leave_types').select('*').eq('org_id', client.orgId)
  const typeMap = new Map((types || []).map((t: any) => [String(t.id), t.name]))
  const items = (rows || []).map((r: any) => ({
    id: r.id,
    member_id: r.member_id,
    leave_type: typeMap.get(String(r.leave_type_id)) || '',
    start_date: r.start_date,
    end_date: r.end_date,
    days_count: Number(r.days_count || 0),
    status: r.status,
    paid: (() => { const t = types?.find((x:any)=> String(x.id)===String(r.leave_type_id)); return t ? !!t.paid : false })()
  }))
  return NextResponse.json({ items })
}
