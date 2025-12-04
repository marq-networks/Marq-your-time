import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { hashApiKey } from '@lib/public/auth'
import crypto from 'crypto'

function allowed(role: string) { return ['admin','owner','integration_manager','super_admin'].includes(role) }

export async function GET(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!allowed(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const org_id = searchParams.get('org_id') || ''
  if (!org_id) return NextResponse.json({ items: [] })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ items: [] })
  const { data } = await sb.from('api_clients').select('*').eq('org_id', org_id).order('created_at', { ascending: false })
  const items = (data || []).map((r: any) => ({ id: r.id, name: r.name, scopes: r.scopes || [], is_active: !!r.is_active, created_at: r.created_at, last_used_at: r.last_used_at || null }))
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!allowed(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'SUPABASE_REQUIRED' }, { status: 400 })
  const body = await req.json().catch(()=>({}))
  const action = body.action || 'create'
  if (action === 'create') {
    const org_id = body.org_id || ''
    const name = body.name || ''
    const scopes = Array.isArray(body.scopes) ? body.scopes : []
    const created_by = req.headers.get('x-user-id') || null
    if (!org_id || !name || !scopes.length) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
    const raw = crypto.randomBytes(24).toString('hex')
    const hash = hashApiKey(raw)
    const { data, error } = await sb.from('api_clients').insert({ org_id, name, api_key_hash: hash, scopes, is_active: true, created_at: new Date(), created_by }).select('*').single()
    if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
    return NextResponse.json({ item: { id: data.id, name: data.name, scopes: data.scopes, is_active: data.is_active, created_at: data.created_at }, raw_key: raw })
  } else if (action === 'toggle') {
    const id = body.id || ''
    const is_active = !!body.is_active
    if (!id) return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })
    const { data } = await sb.from('api_clients').update({ is_active }).eq('id', id).select('*').single()
    return NextResponse.json({ item: { id: data.id, is_active: data.is_active } })
  }
  return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 })
}
