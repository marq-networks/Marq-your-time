import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'

function minutesBetween(a: Date, b: Date) { return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000)) }
function dateISO(d: Date) { return d.toISOString().slice(0,10) }

async function ensureIdempotent(sb: ReturnType<typeof supabaseServer>, device_id: string, member_id: string, local_batch_id: string) {
  const { data } = await sb.from('agent_sync_queues').select('*').eq('device_id', device_id).eq('member_id', member_id).eq('local_batch_id', local_batch_id).limit(1).maybeSingle()
  return data || null
}

function overlaps(aStart: Date, aEnd: Date | null, bStart: Date, bEnd: Date | null) {
  const aE = aEnd ? aEnd.getTime() : Number.MAX_SAFE_INTEGER
  const bE = bEnd ? bEnd.getTime() : Number.MAX_SAFE_INTEGER
  return aStart.getTime() < bE && bStart.getTime() < aE
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const body = await req.json().catch(()=>({}))
  const local_batch_id = body.local_batch_id || body.localBatchId
  const batch_type = body.batch_type || body.batchType
  const device_id = body.device_id || body.deviceId
  const member_id = body.member_id || body.memberId
  const org_id = body.org_id || body.orgId
  const items = Array.isArray(body.items) ? body.items : []
  if (!local_batch_id || !batch_type || !device_id || !member_id || !org_id || !Array.isArray(items)) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })

  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'NOT_SUPPORTED_IN_MEMORY_MODE' }, { status: 400 })

  const existing = await ensureIdempotent(sb, device_id, member_id, local_batch_id)
  if (existing) return NextResponse.json({ status: 'already_applied' })

  const now = new Date()
  const { data: queue, error: qErr } = await sb.from('agent_sync_queues').insert({ device_id, member_id, org_id, local_batch_id, batch_type, item_count: items.length, status: 'pending', received_at: now }).select('*').single()
  if (qErr) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })

  const queue_id = queue.id as string
  const conflicts: { id: string, type: string }[] = []

  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const payload_type = batch_type === 'time' ? 'time_session' : batch_type === 'activity' ? 'activity_event' : 'screenshot'
    await sb.from('agent_sync_items').insert({ sync_queue_id: queue_id, item_index: i, payload_type, payload_json: it })
  }

  try {
    if (batch_type === 'time') {
      const datesToRecompute = new Set<string>()
      for (const sess of items) {
        const started_at = new Date(sess.started_at || sess.startedAt)
        const ended_at = new Date(sess.ended_at || sess.endedAt)
        const date = dateISO(started_at)
        datesToRecompute.add(date)
        const { data: existingSessions } = await sb.from('time_sessions').select('*').eq('member_id', member_id).eq('org_id', org_id).eq('date', date)
        const dup = (existingSessions || []).find((r: any) => Math.abs(new Date(r.start_time).getTime() - started_at.getTime()) <= 2000 && r.end_time && Math.abs(new Date(r.end_time).getTime() - ended_at.getTime()) <= 2000)
        if (dup) {
          const { data: conf } = await sb.from('agent_sync_conflicts').insert({ device_id, member_id, org_id, conflict_type: 'duplicate_time_session', details: { local_session_id: sess.local_session_id || sess.localSessionId, duplicate_of_session_id: dup.id } }).select('*').single()
          conflicts.push({ id: (conf as any).id, type: 'duplicate_time_session' })
          continue
        }
        const overlapWith = (existingSessions || []).find((r: any) => overlaps(new Date(r.start_time), r.end_time ? new Date(r.end_time) : null, started_at, ended_at))
        if (overlapWith) {
          const { data: conf } = await sb.from('agent_sync_conflicts').insert({ device_id, member_id, org_id, conflict_type: 'overlapping_time_session', details: { local_session_id: sess.local_session_id || sess.localSessionId, overlap_with_session_id: overlapWith.id, range: { start: started_at.toISOString(), end: ended_at.toISOString() } } }).select('*').single()
          conflicts.push({ id: (conf as any).id, type: 'overlapping_time_session' })
          continue
        }
        const total_minutes = minutesBetween(started_at, ended_at)
        const { data: inserted } = await sb.from('time_sessions').insert({ member_id, org_id, date, start_time: started_at, end_time: ended_at, source: 'offline', status: 'closed', total_minutes, created_at: now, updated_at: now }).select('*').single()
        const breaks = Array.isArray(sess.breaks) ? sess.breaks : []
        for (const b of breaks) {
          const bStart = new Date(b.started_at || b.startedAt)
          const bEnd = new Date(b.ended_at || b.endedAt)
          const bTotal = minutesBetween(bStart, bEnd)
          await sb.from('break_sessions').insert({ time_session_id: inserted!.id, break_rule_id: null, label: b.label || 'Break', start_time: bStart, end_time: bEnd, total_minutes: bTotal, is_paid: false, created_at: now, updated_at: now })
        }
      }
      for (const d of datesToRecompute) {
        const { data: sessRows } = await sb.from('time_sessions').select('*').eq('member_id', member_id).eq('org_id', org_id).eq('date', d)
        const ids = (sessRows || []).map((r: any) => r.id)
        const { data: brRows } = ids.length ? await sb.from('break_sessions').select('*').in('time_session_id', ids) : { data: [] }
        const worked = (sessRows || []).filter((r: any) => r.status === 'closed').reduce((s: number, r: any) => s + Number(r.total_minutes || 0), 0)
        const paidBreak = (brRows || []).filter((r: any) => !!r.is_paid).reduce((s: number, r: any) => s + Number(r.total_minutes || 0), 0)
        const unpaidBreak = (brRows || []).filter((r: any) => !r.is_paid).reduce((s: number, r: any) => s + Number(r.total_minutes || 0), 0)
        const workedMinusUnpaid = Math.max(0, worked - unpaidBreak)
        const { data: existing } = await sb.from('daily_time_summaries').select('*').eq('member_id', member_id).eq('org_id', org_id).eq('date', d).limit(1).maybeSingle()
        const scheduled = Number(existing?.scheduled_minutes || 0)
        let status: 'normal'|'extra'|'short'|'absent'|'unconfigured' = 'normal'
        let extra = 0
        let short = 0
        if (scheduled === 0) status = workedMinusUnpaid > 0 ? 'normal' : 'unconfigured'
        else if (workedMinusUnpaid === 0) status = 'absent'
        else if (workedMinusUnpaid > scheduled) { status = 'extra'; extra = workedMinusUnpaid - scheduled }
        else if (workedMinusUnpaid < scheduled) { status = 'short'; short = scheduled - workedMinusUnpaid }
        const payload = {
          member_id,
          org_id,
          date: d,
          work_pattern_id: existing?.work_pattern_id ?? null,
          scheduled_minutes: scheduled,
          worked_minutes: workedMinusUnpaid,
          paid_break_minutes: paidBreak,
          unpaid_break_minutes: unpaidBreak,
          extra_minutes: extra,
          short_minutes: short,
          status,
          updated_at: new Date(),
          created_at: existing?.created_at ? new Date(existing.created_at) : new Date()
        }
        if (existing?.id) await sb.from('daily_time_summaries').update(payload).eq('id', existing.id)
        else await sb.from('daily_time_summaries').insert(payload)
      }
    } else if (batch_type === 'activity') {
      for (const ev of items) {
        const ts = new Date(ev.timestamp)
        const settings = await (async ()=>{ const { data } = await sb.from('member_privacy_settings').select('*').eq('member_id', member_id).eq('org_id', org_id).limit(1).maybeSingle(); return data })()
        if (!settings || settings.allow_activity_tracking !== true) {
          const { data: conf } = await sb.from('agent_sync_conflicts').insert({ device_id, member_id, org_id, conflict_type: 'privacy_blocked', details: { reason: 'allow_activity_tracking=false', timestamp: ts.toISOString() } }).select('*').single()
          conflicts.push({ id: (conf as any).id, type: 'privacy_blocked' })
          continue
        }
        const { data: sessions } = await sb.from('time_sessions').select('*').eq('member_id', member_id).eq('org_id', org_id).eq('date', dateISO(ts))
        const covering = (sessions || []).find((r: any) => new Date(r.start_time).getTime() <= ts.getTime() && r.end_time && new Date(r.end_time).getTime() >= ts.getTime())
        if (!covering) {
          const { data: conf } = await sb.from('agent_sync_conflicts').insert({ device_id, member_id, org_id, conflict_type: 'no_time_session', details: { timestamp: ts.toISOString(), app_name: ev.app_name, window_title: ev.window_title } }).select('*').single()
          conflicts.push({ id: (conf as any).id, type: 'no_time_session' })
          continue
        }
        const { data: existingTS } = await sb.from('tracking_sessions').select('*').eq('time_session_id', covering.id).eq('consent_given', true).order('started_at', { ascending: true }).limit(1).maybeSingle()
        let trackingId = existingTS?.id
        if (!trackingId) {
          const { data: created } = await sb.from('tracking_sessions').insert({ time_session_id: covering.id, member_id, org_id, started_at: new Date(covering.start_time), ended_at: new Date(covering.end_time), consent_given: true, consent_text: 'Offline replay', created_at: now }).select('*').single()
          trackingId = created?.id
        }
        const { data: possibleTs } = await sb.from('tracking_sessions').select('id').eq('member_id', member_id).eq('org_id', org_id)
        const tsIds = (possibleTs || []).map((t: any) => t.id)
        const { data: dup } = tsIds.length ? await sb.from('activity_events').select('id').in('tracking_session_id', tsIds).eq('timestamp', ts).eq('app_name', ev.app_name).eq('window_title', ev.window_title).limit(1).maybeSingle() : { data: null }
        if (dup?.id) {
          const { data: conf } = await sb.from('agent_sync_conflicts').insert({ device_id, member_id, org_id, conflict_type: 'duplicate_event', details: { tracking_session_id: trackingId, timestamp: ts.toISOString(), window_title: ev.window_title } }).select('*').single()
          conflicts.push({ id: (conf as any).id, type: 'duplicate_event' })
          continue
        }
        await sb.from('activity_events').insert({ tracking_session_id: trackingId!, timestamp: ts, app_name: ev.app_name, window_title: ev.window_title, url: ev.url ?? null, category: null, is_active: !!ev.is_active, keyboard_activity_score: ev.keyboard_activity_score ?? null, mouse_activity_score: ev.mouse_activity_score ?? null, created_at: now })
      }
    } else if (batch_type === 'screenshot') {
      for (const sc of items) {
        const ts = new Date(sc.timestamp)
        const settings = await (async ()=>{ const { data } = await sb.from('member_privacy_settings').select('*').eq('member_id', member_id).eq('org_id', org_id).limit(1).maybeSingle(); return data })()
        if (!settings || settings.allow_screenshots !== true) {
          const { data: conf } = await sb.from('agent_sync_conflicts').insert({ device_id, member_id, org_id, conflict_type: 'privacy_blocked', details: { reason: 'allow_screenshots=false', timestamp: ts.toISOString() } }).select('*').single()
          conflicts.push({ id: (conf as any).id, type: 'privacy_blocked' })
          continue
        }
        const { data: sessions } = await sb.from('time_sessions').select('*').eq('member_id', member_id).eq('org_id', org_id).eq('date', dateISO(ts))
        const covering = (sessions || []).find((r: any) => new Date(r.start_time).getTime() <= ts.getTime() && r.end_time && new Date(r.end_time).getTime() >= ts.getTime())
        if (!covering) {
          const { data: conf } = await sb.from('agent_sync_conflicts').insert({ device_id, member_id, org_id, conflict_type: 'no_time_session', details: { timestamp: ts.toISOString() } }).select('*').single()
          conflicts.push({ id: (conf as any).id, type: 'no_time_session' })
          continue
        }
        const { data: existingTS } = await sb.from('tracking_sessions').select('*').eq('time_session_id', covering.id).eq('consent_given', true).order('started_at', { ascending: true }).limit(1).maybeSingle()
        let trackingId = existingTS?.id
        if (!trackingId) {
          const { data: created } = await sb.from('tracking_sessions').insert({ time_session_id: covering.id, member_id, org_id, started_at: new Date(covering.start_time), ended_at: new Date(covering.end_time), consent_given: true, consent_text: 'Offline replay', created_at: now }).select('*').single()
          trackingId = created?.id
        }
        const storage_path = sc.storage_path || sc.image_url || null
        const thumbnail_path = sc.thumbnail_path || sc.image_url || null
        if (!storage_path || !thumbnail_path) {
          const { data: conf } = await sb.from('agent_sync_conflicts').insert({ device_id, member_id, org_id, conflict_type: 'missing_image', details: { note: 'image_base64 ignored; storage_path/thumbnail_path required' } }).select('*').single()
          conflicts.push({ id: (conf as any).id, type: 'missing_image' })
          continue
        }
        await sb.from('screenshots').insert({ tracking_session_id: trackingId!, timestamp: ts, storage_path, thumbnail_path, blur_level: settings.mask_personal_windows ? 60 : 0, was_masked: !!settings.mask_personal_windows, created_at: now })
      }
    }
    await sb.from('agent_sync_queues').update({ status: 'applied', processed_at: new Date() }).eq('id', queue_id)
    return NextResponse.json({ status: 'applied', conflicts })
  } catch (e: any) {
    await sb.from('agent_sync_queues').update({ status: 'error', error_message: String(e?.message || e), processed_at: new Date() }).eq('id', queue_id)
    return NextResponse.json({ status: 'error', error: String(e?.message || e) }, { status: 500 })
  }
}
