import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!['admin','owner','super_admin'].includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'NOT_SUPPORTED_IN_MEMORY_MODE' }, { status: 400 })
  const body = await req.json().catch(()=>({}))
  const org_id = body.org_id || body.orgId
  const plan_id = body.plan_id || body.planId
  const seats = Number(body.seats || 0)
  if (!org_id || !plan_id || !seats) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const now = new Date()
  await sb.from('org_subscriptions').update({ status: 'cancelled', cancelled_at: now }).eq('org_id', org_id).in('status', ['trial','active','past_due'])
  const { data, error } = await sb.from('org_subscriptions').insert({ org_id, plan_id, status: 'active', seats, started_at: now }).select('*').single()
  if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ subscription: data })
}

