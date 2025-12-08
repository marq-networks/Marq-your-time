import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const actor = req.headers.get('x-user-id') || ''
  if (role && !['admin','owner','super_admin','manager','member'].includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json().catch(()=>({}))
  const kr_id = body.kr_id || body.key_result_id || body.id
  const current_value = body.current_value ?? body.currentValue
  if (!kr_id || current_value === undefined) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'SUPABASE_REQUIRED' }, { status: 400 })
  if (role === 'member' && actor) {
    const { data: kr } = await sb.from('okr_key_results').select('id, objective_id').eq('id', kr_id).maybeSingle()
    if (!kr) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    const { data: obj } = await sb.from('okr_objectives').select('id, okr_set_id').eq('id', kr.objective_id).maybeSingle()
    if (!obj) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    const { data: set } = await sb.from('okr_sets').select('id, member_id').eq('id', obj.okr_set_id).maybeSingle()
    if (!set) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    if (String(set.member_id || '') !== String(actor)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  const { data, error } = await sb.from('okr_key_results').update({ current_value }).eq('id', kr_id).select('*').single()
  if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ id: data.id, current_value: Number(data.current_value || 0) })
}
