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
  const date_start = searchParams.get('date_start') || ''
  const date_end = searchParams.get('date_end') || ''
  if (!date_start || !date_end) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const { data: rows } = await sb.from('payroll_periods').select('*').eq('org_id', client.orgId).lte('start_date', date_end).gte('end_date', date_start).order('start_date', { ascending: false })
  const items = (rows || []).map((r: any) => ({ id: r.id, start_date: r.start_date, end_date: r.end_date, status: r.status }))
  return NextResponse.json({ items })
}
