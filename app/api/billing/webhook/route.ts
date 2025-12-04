import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

/**
 * Billing Webhook Placeholder
 *
 * This endpoint is a stub for future Stripe (or other provider) webhooks.
 * It performs a lightweight signature check placeholder and updates
 * subscription status based on incoming event types.
 *
 * Security note: Replace placeholder signature validation with real
 * verification when integrating a payment provider.
 */
export async function POST(req: NextRequest) {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'NOT_SUPPORTED_IN_MEMORY_MODE' }, { status: 400 })

  const sig = req.headers.get('stripe-signature') || req.headers.get('x-billing-signature') || ''
  const ok = !!sig && sig.length > 8
  if (!ok) return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 400 })

  const body = await req.json().catch(()=>({}))
  const type = (body.type || '').toLowerCase()
  const org_id = body.org_id || body.orgId || body.data?.object?.metadata?.org_id || ''
  if (!type || !org_id) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })

  const { data: sub } = await sb.from('org_subscriptions').select('*').eq('org_id', org_id).in('status', ['trial','active','past_due']).order('started_at', { ascending: false }).limit(1).maybeSingle()
  if (!sub) return NextResponse.json({ ok: true, message: 'NO_SUBSCRIPTION' })

  const now = new Date()
  if (type === 'invoice.paid' || type === 'charge.succeeded') {
    await sb.from('org_subscriptions').update({ status: 'active', updated_at: now }).eq('id', sub.id)
  } else if (type === 'invoice.payment_failed' || type === 'charge.failed') {
    await sb.from('org_subscriptions').update({ status: 'past_due', updated_at: now }).eq('id', sub.id)
  } else if (type === 'customer.subscription.deleted' || type === 'subscription.cancelled') {
    await sb.from('org_subscriptions').update({ status: 'cancelled', cancelled_at: now, updated_at: now }).eq('id', sub.id)
  }

  return NextResponse.json({ ok: true })
}

