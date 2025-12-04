import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const org_id = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!['admin','owner','super_admin'].includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  if (!org_id) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ subscription: null })
  const { data: sub } = await sb.from('org_subscriptions').select('*').eq('org_id', org_id).in('status', ['trial','active','past_due']).order('started_at', { ascending: false }).limit(1).maybeSingle()
  if (!sub) return NextResponse.json({ subscription: null })
  const { data: plan } = await sb.from('billing_plans').select('*').eq('id', sub.plan_id).maybeSingle()
  const subscription = { id: sub.id, org_id: sub.org_id, status: sub.status, seats: sub.seats, started_at: sub.started_at, trial_ends_at: sub.trial_ends_at, plan: plan ? { id: plan.id, code: plan.code, name: plan.name, price_per_seat: Number(plan.price_per_seat||0), price_per_login: plan.price_per_login ? Number(plan.price_per_login): null, currency: plan.currency } : null }
  return NextResponse.json({ subscription })
}
