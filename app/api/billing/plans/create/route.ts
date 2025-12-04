import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (role !== 'super_admin') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'NOT_SUPPORTED_IN_MEMORY_MODE' }, { status: 400 })
  const body = await req.json().catch(()=>({}))
  const code = body.code
  const name = body.name
  const description = body.description || ''
  const price_per_seat = Number(body.price_per_seat || 0)
  const price_per_login = body.price_per_login !== undefined ? Number(body.price_per_login) : null
  const currency = body.currency || 'USD'
  if (!code || !name) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const now = new Date()
  const { data, error } = await sb.from('billing_plans').upsert({ code, name, description, price_per_seat, price_per_login, currency, is_active: true, created_at: now }, { onConflict: 'code' }).select('*').single()
  if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ item: data })
}
