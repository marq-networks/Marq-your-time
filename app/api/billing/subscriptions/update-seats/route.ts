import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!['admin','owner','super_admin'].includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'NOT_SUPPORTED_IN_MEMORY_MODE' }, { status: 400 })
  const body = await req.json().catch(()=>({}))
  const org_id = body.org_id || body.orgId
  const seats = Number(body.seats || 0)
  if (!org_id || !seats) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const { data: sub } = await sb.from('org_subscriptions').select('*').eq('org_id', org_id).in('status', ['trial','active','past_due']).order('started_at', { ascending: false }).limit(1).maybeSingle()
  if (!sub) return NextResponse.json({ error: 'NO_SUBSCRIPTION' }, { status: 404 })
  const { data } = await sb.from('org_subscriptions').update({ seats }).eq('id', sub.id).select('*').single()
  return NextResponse.json({ subscription: data })
}
