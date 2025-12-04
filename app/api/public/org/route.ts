import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { authenticatePublicApi, hasScope } from '@lib/public/auth'

export async function GET(req: NextRequest) {
  const client = await authenticatePublicApi(req)
  if (!client) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!hasScope(client.scopes, 'read:org')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'SUPABASE_REQUIRED' }, { status: 400 })
  const { data: org } = await sb.from('organizations').select('*').eq('id', client.orgId).limit(1).maybeSingle()
  if (!org) return NextResponse.json({ error: 'ORG_NOT_FOUND' }, { status: 404 })
  const { data: sub } = await sb.from('org_subscriptions').select('*').eq('org_id', client.orgId).in('status', ['trial','active','past_due']).order('started_at', { ascending: false }).limit(1).maybeSingle()
  let plan: any = null
  if (sub) {
    const { data: p } = await sb.from('billing_plans').select('*').eq('id', sub.plan_id).limit(1).maybeSingle()
    if (p) plan = { id: p.id, code: p.code, name: p.name, currency: p.currency, price_per_seat: p.price_per_seat ?? null, price_per_login: p.price_per_login ?? null }
  }
  const mrr = plan && sub ? Number(sub.seats || 0) * Number(plan.price_per_seat || 0) : null
  return NextResponse.json({
    id: org.id,
    name: org.org_name,
    subscription_type: org.subscription_type,
    price_per_login: Number(org.price_per_login || 0),
    total_licensed_seats: Number(org.total_licensed_seats || 0),
    used_seats: Number(org.used_seats || 0),
    plan,
    subscription_status: sub ? sub.status : null,
    seats: sub ? Number(sub.seats || 0) : null,
    mrr
  })
}
