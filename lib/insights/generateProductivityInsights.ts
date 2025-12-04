import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { publishNotification } from '@lib/db'
/**
 * Productivity Insights – Rule thresholds and logic
 *
 * Late Starts:
 * - Baseline: average first session start time over previous 14 days
 * - Current: today’s first session start
 * - Trigger: today is >= 60 minutes later than baseline
 * - Severity: low >=60, medium >=90, high >=120 minutes later
 *
 * Idle Spike:
 * - Baseline: average idle minutes/day over previous 14 days (from activity events)
 * - Current: today’s idle minutes
 * - Trigger: today > 150% of baseline and > 60 minutes absolute idle
 * - Severity: low >=1.5x, medium >=2x, high >=3x baseline
 *
 * Overwork:
 * - Current window: last 3 days
 * - Trigger: worked minutes >= 540 (9h) on all last 3 days
 * - Severity: medium at 3 consecutive, high if extended beyond (engine may escalate)
 *
 * Burnout Risk:
 * - Window: last 7 days
 * - Trigger: total worked minutes >= 7*480 (8h/day avg) with <=1 absent day
 * - Severity: high if >= 7*540 (9h/day avg)
 *
 * Performance Drop:
 * - Baseline: average worked minutes of prior days in the 14-day set
 * - Current: today worked minutes
 * - Trigger: today < 60% of baseline and difference >= 120 minutes
 * - Severity: high if ratio < 40%, else medium
 *
 * Deduplication:
 * - For each insight type, we skip insert if an identical (org_id, member_id, type, date_range) already exists.
 */

function dateISO(d: Date) { return d.toISOString().slice(0,10) }
function addDays(s: string, n: number) { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return dateISO(d) }
function rangeStr(start: string, end: string) { return `[${start},${end})` }

function sevFromRatio(r: number, thresholds: { low: number, med: number, high: number }) {
  if (r >= thresholds.high) return 'high'
  if (r >= thresholds.med) return 'medium'
  return 'low'
}

export async function generateProductivityInsights(orgId: string, date?: string) {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return { inserted: 0 }
  const today = date || dateISO(new Date())
  const start14 = addDays(today, -14)
  const start7 = addDays(today, -7)
  const start3 = addDays(today, -3)

  const { data: members } = await sb.from('users').select('id').eq('org_id', orgId)
  const memberIds = (members || []).map((m: any) => String(m.id))
  let inserted = 0

  for (const mid of memberIds) {
    const { data: dRows } = await sb.from('daily_time_summaries').select('*').eq('org_id', orgId).eq('member_id', mid).gte('date', start14).lte('date', today)
    const byDate: Record<string, any> = {}
    for (const r of (dRows || []) as any[]) byDate[r.date] = r

    const { data: sessRows } = await sb.from('time_sessions').select('date,start_time').eq('org_id', orgId).eq('member_id', mid).gte('date', start14).lte('date', today)
    const startByDate = new Map<string, number>()
    for (const s of (sessRows || []) as any[]) {
      const t = new Date(s.start_time).getTime()
      const prev = startByDate.get(s.date)
      if (!prev || t < prev) startByDate.set(s.date, t)
    }

    const prevDays = Object.keys(byDate).filter(d => d < today)
    const prevStarts = prevDays.map(d => startByDate.get(d)).filter(Boolean) as number[]
    const avgPrevStart = prevStarts.length ? new Date(Math.round(prevStarts.reduce((s,v)=>s+v,0)/prevStarts.length)) : null
    const todayStartMs = startByDate.get(today)

    if (avgPrevStart && todayStartMs) {
      const diffMin = Math.round((todayStartMs - avgPrevStart.getTime())/60000)
      if (diffMin >= 60) {
        const severity = sevFromRatio(diffMin, { low: 60, med: 90, high: 120 }) as 'low'|'medium'|'high'
        const summary = `Start time appears later than usual (around +${diffMin} minutes). Consider a lighter start tomorrow if helpful.`
        const details = { average_start: avgPrevStart.toISOString(), today_start: new Date(todayStartMs).toISOString(), difference_minutes: diffMin }
        const date_range = rangeStr(today, addDays(today, 1))
        const { count: existsLate } = await sb.from('productivity_insights').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('member_id', mid).eq('insight_type', 'late_starts').eq('date_range', date_range)
        if ((existsLate || 0) === 0) {
          await sb.from('productivity_insights').insert({ org_id: orgId, member_id: mid, date_range, insight_type: 'late_starts', severity, summary, details })
          if (severity === 'high') await publishNotification({ orgId, memberId: mid, type: 'system', title: 'Insight: Later start observed', message: summary })
          inserted++
        }
      }
    }

    const { data: tsToday } = await sb.from('tracking_sessions').select('id').eq('org_id', orgId).eq('member_id', mid).gte('started_at', new Date(today + 'T00:00:00')).lte('started_at', new Date(today + 'T23:59:59'))
    const todayIds = (tsToday || []).map((t:any)=> t.id)
    const { data: evRows } = todayIds.length ? await sb.from('activity_events').select('timestamp,is_active').in('tracking_session_id', todayIds) : { data: [] }
    const todayIdle = (evRows || []).filter((e:any)=> e.is_active === false).length

    const { data: tsPrev } = await sb.from('tracking_sessions').select('id,started_at').eq('org_id', orgId).eq('member_id', mid).gte('started_at', new Date(start14 + 'T00:00:00')).lt('started_at', new Date(today + 'T00:00:00'))
    const prevIds = (tsPrev || []).map((t:any)=> t.id)
    const { data: prevEv } = prevIds.length ? await sb.from('activity_events').select('timestamp,is_active').in('tracking_session_id', prevIds) : { data: [] }
    const prevIdleByDay = new Map<string, number>()
    for (const e of (prevEv || []) as any[]) {
      const d = dateISO(new Date(e.timestamp))
      if (!prevIdleByDay.has(d)) prevIdleByDay.set(d, 0)
      if (e.is_active === false) prevIdleByDay.set(d, (prevIdleByDay.get(d) || 0) + 1)
    }
    const avgPrevIdle = Array.from(prevIdleByDay.values()).reduce((s,v)=>s+v,0) / Math.max(1, prevIdleByDay.size)
    if (todayIdle > Math.round(avgPrevIdle * 1.5) && todayIdle > 60) {
      const ratio = avgPrevIdle ? todayIdle/avgPrevIdle : 2
      const severity = sevFromRatio(ratio, { low: 1.5, med: 2, high: 3 }) as 'low'|'medium'|'high'
      const summary = `Idle time looks higher than typical today. A short stretch or focus block may help.`
      const details = { today_idle_minutes: todayIdle, average_idle_minutes: Math.round(avgPrevIdle) }
      const date_range = rangeStr(today, addDays(today,1))
      const { count: existsIdle } = await sb.from('productivity_insights').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('member_id', mid).eq('insight_type', 'idle_spike').eq('date_range', date_range)
      if ((existsIdle || 0) === 0) {
        await sb.from('productivity_insights').insert({ org_id: orgId, member_id: mid, date_range, insight_type: 'idle_spike', severity, summary, details })
        if (severity === 'high') await publishNotification({ orgId, memberId: mid, type: 'system', title: 'Insight: Idle time higher than usual', message: summary })
        inserted++
      }
    }

    const recent3 = [start3, addDays(start3,1), addDays(start3,2)].map(d => byDate[d]).filter(Boolean)
    const highDays = recent3.filter(r => Number(r.worked_minutes||0) >= 540).length
    if (highDays >= 3) {
      const severity = highDays >= 5 ? 'high' : 'medium'
      const summary = `Recent days show higher-than-usual hours. Planning brief recovery windows might be useful.`
      const details = { consecutive_days_over_threshold: highDays, threshold_minutes: 540 }
      const date_range = rangeStr(start3, addDays(start3,3))
      const { count: existsOver } = await sb.from('productivity_insights').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('member_id', mid).eq('insight_type', 'overwork').eq('date_range', date_range)
      if ((existsOver || 0) === 0) {
        await sb.from('productivity_insights').insert({ org_id: orgId, member_id: mid, date_range, insight_type: 'overwork', severity, summary, details })
        if (severity === 'high') await publishNotification({ orgId, memberId: mid, type: 'system', title: 'Insight: Several days with high hours', message: summary })
        inserted++
      }
    }

    const last7 = Array.from({length:7}).map((_,i)=> addDays(start7, i))
    const sevenRows = last7.map(d=> byDate[d]).filter(Boolean)
    const total7 = sevenRows.reduce((s,r)=> s + Number(r.worked_minutes||0), 0)
    const absentDays = sevenRows.filter(r => r && r.status === 'absent').length
    if (total7 >= 7*480 && absentDays <= 1) {
      const severity = total7 >= 7*540 ? 'high' : 'medium'
      const summary = `Sustained high hours with limited time off may benefit from gentle pacing or planned downtime.`
      const details = { total7_worked_minutes: total7, absent_days: absentDays }
      const date_range = rangeStr(start7, addDays(start7,7))
      const { count: existsBurn } = await sb.from('productivity_insights').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('member_id', mid).eq('insight_type', 'burnout_risk').eq('date_range', date_range)
      if ((existsBurn || 0) === 0) {
        await sb.from('productivity_insights').insert({ org_id: orgId, member_id: mid, date_range, insight_type: 'burnout_risk', severity, summary, details })
        if (severity === 'high') await publishNotification({ orgId, memberId: mid, type: 'system', title: 'Insight: Potential burnout risk pattern', message: summary })
        inserted++
      }
    }

    const todayWorked = Number(byDate[today]?.worked_minutes||0)
    const prevWorkedVals = prevDays.map(d=> Number(byDate[d]?.worked_minutes||0))
    const avgPrevWorked = prevWorkedVals.length ? Math.round(prevWorkedVals.reduce((s,v)=>s+v,0)/prevWorkedVals.length) : 0
    if (avgPrevWorked > 0 && todayWorked < Math.round(avgPrevWorked * 0.6) && (avgPrevWorked - todayWorked) >= 120) {
      const ratio = todayWorked/avgPrevWorked
      const severity = ratio < 0.4 ? 'high' : 'medium'
      const summary = `Today’s hours seem lower than your recent average. If helpful, consider a focused block tomorrow.`
      const details = { today_worked_minutes: todayWorked, average_worked_minutes: avgPrevWorked }
      const date_range = rangeStr(today, addDays(today,1))
      const { count: existsPerf } = await sb.from('productivity_insights').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('member_id', mid).eq('insight_type', 'performance_drop').eq('date_range', date_range)
      if ((existsPerf || 0) === 0) {
        await sb.from('productivity_insights').insert({ org_id: orgId, member_id: mid, date_range, insight_type: 'performance_drop', severity, summary, details })
        inserted++
      }
    }
  }

  return { inserted }
}
