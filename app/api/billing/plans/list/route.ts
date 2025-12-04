import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

export async function GET(_req: NextRequest) {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ items: [] })
  const { data } = await sb.from('billing_plans').select('*').eq('is_active', true).order('created_at', { ascending: true })
  const items = (data||[]).map((r:any)=> ({ id: r.id, code: r.code, name: r.name, description: r.description || '', price_per_seat: Number(r.price_per_seat||0), price_per_login: r.price_per_login ? Number(r.price_per_login) : null, currency: r.currency }))
  return NextResponse.json({ items })
}

