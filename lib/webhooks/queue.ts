import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

export async function queueWebhookEvent(org_id: string, event_type: string, payload: any): Promise<void> {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return
  const { data: hooks } = await sb.from('webhooks').select('*').eq('org_id', org_id).eq('is_active', true)
  const targets = (hooks || []).filter((h: any) => Array.isArray(h.events) && h.events.includes(event_type))
  if (!targets.length) return
  const now = new Date()
  for (const h of targets) {
    await sb.from('webhook_events').insert({ webhook_id: h.id, event_type, payload, status: 'pending', attempt_count: 0, last_attempt_at: null, error_message: null, created_at: now })
    await sb.from('webhooks').update({ last_triggered_at: now }).eq('id', h.id)
  }
}
