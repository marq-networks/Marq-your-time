import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import crypto from 'crypto'

function sign(secret: string, body: string) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}

const MAX_ATTEMPTS = 5
const BASE_DELAY_SEC = 30

function dueForRetry(last?: string | null, attempts?: number) {
  const a = Math.max(0, Number(attempts || 0))
  if (!last) return true
  const backoffSec = Math.min(3600, BASE_DELAY_SEC * Math.pow(2, a))
  const lastMs = new Date(last).getTime()
  return Date.now() - lastMs >= backoffSec * 1000
}

export async function runDispatchBatch(limit = 25): Promise<{ processed: number }> {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return { processed: 0 }
  const { data: pending } = await sb.from('webhook_events').select('*').eq('status', 'pending').order('created_at', { ascending: true }).limit(limit * 4)
  const candidates = (pending || []).filter((e: any) => dueForRetry(e.last_attempt_at, e.attempt_count)).slice(0, limit)
  const ids = candidates.map((e: any) => e.webhook_id)
  const { data: hooks } = ids.length ? await sb.from('webhooks').select('*').in('id', ids) : { data: [] }
  const hookMap = new Map((hooks || []).map((h: any) => [String(h.id), h]))
  let processed = 0
  for (const ev of candidates || []) {
    const h = hookMap.get(String(ev.webhook_id))
    if (!h) {
      const attempts = (ev.attempt_count || 0) + 1
      const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending'
      await sb.from('webhook_events').update({ status, attempt_count: attempts, last_attempt_at: new Date(), error_message: 'webhook_not_found' }).eq('id', ev.id)
      continue
    }
    const body = JSON.stringify(ev.payload || {})
    const sig = sign(String(h.secret || ''), body)
    let ok = false
    let err = ''
    try {
      const res = await fetch(String(h.target_url), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Marq-Webhook-Id': String(ev.id),
          'X-Marq-Event': String(ev.event_type),
          'X-Marq-Signature': sig
        },
        body
      })
      ok = res.ok
      if (!ok) err = `http_${res.status}`
    } catch (e: any) {
      ok = false
      err = 'network_error'
    }
    const now = new Date()
    if (ok) {
      await sb.from('webhook_events').update({ status: 'delivered', attempt_count: (ev.attempt_count || 0) + 1, last_attempt_at: now, error_message: null }).eq('id', ev.id)
    } else {
      const attempts = (ev.attempt_count || 0) + 1
      const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending'
      await sb.from('webhook_events').update({ status, attempt_count: attempts, last_attempt_at: now, error_message: err }).eq('id', ev.id)
    }
    processed += 1
  }
  return { processed }
}
