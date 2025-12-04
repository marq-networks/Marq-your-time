import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { authenticatePublicApi, hasScope } from '@lib/public/auth'

export async function GET(req: NextRequest) {
  const client = await authenticatePublicApi(req)
  if (!client) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!hasScope(client.scopes, 'read:time')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'SUPABASE_REQUIRED' }, { status: 400 })
  const { searchParams } = new URL(req.url)
  const date_start = searchParams.get('date_start') || ''
  const date_end = searchParams.get('date_end') || ''
  const member_id = searchParams.get('member_id') || ''
  if (!date_start || !date_end) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  let q = sb.from('time_sessions').select('*').eq('org_id', client.orgId).gte('date', date_start).lte('date', date_end).order('start_time', { ascending: true })
  if (member_id) q = q.eq('member_id', member_id)
  const { data: rows } = await q
  const items = (rows || []).map((r: any) => ({
    id: r.id,
    member_id: r.member_id,
    started_at: r.start_time,
    ended_at: r.end_time || null,
    duration_minutes: r.total_minutes !== null && r.total_minutes !== undefined ? Number(r.total_minutes) : (r.end_time ? Math.round((new Date(r.end_time).getTime() - new Date(r.start_time).getTime()) / 60000) : null),
    source: r.source
  }))
  return NextResponse.json({ items })
}
