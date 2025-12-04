import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { authenticatePublicApi, hasScope } from '@lib/public/auth'

export async function GET(req: NextRequest) {
  const client = await authenticatePublicApi(req)
  if (!client) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!hasScope(client.scopes, 'read:billing')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'SUPABASE_REQUIRED' }, { status: 400 })
  const { data: sub } = await sb.from('org_subscriptions').select('*').eq('org_id', client.orgId).in('status', ['trial','active','past_due']).order('started_at', { ascending: false }).limit(1).maybeSingle()
  if (!sub) return NextResponse.json({ subscription: null })
  const { data: plan } = await sb.from('billing_plans').select('*').eq('id', sub.plan_id).limit(1).maybeSingle()
  const mrr = plan ? Number(sub.seats || 0) * Number(plan.price_per_seat || 0) : null
  return NextResponse.json({ subscription: { id: sub.id, status: sub.status, seats: Number(sub.seats || 0), plan: plan ? { id: plan.id, code: plan.code, name: plan.name, currency: plan.currency, price_per_seat: plan.price_per_seat ?? null, price_per_login: plan.price_per_login ?? null } : null, mrr } })
}
