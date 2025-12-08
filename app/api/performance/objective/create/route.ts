import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (role && !['admin','owner','super_admin','manager'].includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json().catch(()=>({}))
  const okr_set_id = body.okr_set_id || body.okrSetId
  const title = body.title
  const description = body.description || null
  const weight = body.weight ?? 1.0
  if (!okr_set_id || !title) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'SUPABASE_REQUIRED' }, { status: 400 })
  const now = new Date()
  const payload = { okr_set_id, title, description, weight, created_at: now }
  const { data, error } = await sb.from('okr_objectives').insert(payload).select('*').single()
  if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ id: data.id })
}
