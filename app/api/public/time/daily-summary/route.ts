import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { authenticatePublicApi, hasScope } from '@lib/public/auth'

function parseList(sp: URLSearchParams, key: string) {
  const vals = sp.getAll(key)
  if (vals.length > 1) return vals
  const one = sp.get(key)
  if (!one) return []
  return one.split(',').map(s => s.trim()).filter(Boolean)
}

export async function GET(req: NextRequest) {
  const client = await authenticatePublicApi(req)
  if (!client) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!hasScope(client.scopes, 'read:time')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'SUPABASE_REQUIRED' }, { status: 400 })
  const { searchParams } = new URL(req.url)
  const date_start = searchParams.get('date_start') || ''
  const date_end = searchParams.get('date_end') || ''
  const member_ids = parseList(searchParams, 'member_ids[]')
  const dept_ids = parseList(searchParams, 'department_ids[]')
  if (!date_start || !date_end) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  let q = sb.from('daily_time_summaries').select('*').eq('org_id', client.orgId).gte('date', date_start).lte('date', date_end).order('date', { ascending: true })
  if (member_ids.length) q = q.in('member_id', member_ids)
  if (dept_ids.length) {
    const { data: users } = await sb.from('users').select('id').eq('org_id', client.orgId).in('department_id', dept_ids)
    const mids = (users || []).map((u: any) => String(u.id))
    if (mids.length) q = q.in('member_id', mids)
  }
  const { data: rows } = await q
  const { data: leaves } = await sb.from('leave_requests').select('*').eq('org_id', client.orgId).eq('status', 'approved').lte('start_date', date_end).gte('end_date', date_start)
  const leaveMap = new Map<string, boolean>()
  for (const l of leaves || []) {
    const start = new Date(String(l.start_date) + 'T00:00:00')
    const end = new Date(String(l.end_date) + 'T00:00:00')
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = `${l.member_id}|${d.toISOString().slice(0,10)}`
      leaveMap.set(key, true)
    }
  }
  const items = (rows || []).map((r: any) => {
    const key = `${r.member_id}|${r.date}`
    const st = leaveMap.get(key) ? 'Leave' : (r.status === 'absent' ? 'Absent' : 'Present')
    return {
      member_id: r.member_id,
      date: r.date,
      worked_minutes: Number(r.worked_minutes || 0),
      extra_minutes: Number(r.extra_minutes || 0),
      short_minutes: Number(r.short_minutes || 0),
      status: st
    }
  })
  return NextResponse.json({ items })
}
