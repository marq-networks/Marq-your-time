import { NextRequest, NextResponse } from 'next/server'
import { listUsers, listDepartments, listDailyLogs, listOrgCategoryRules } from '@lib/db'
import { supabaseServer, isSupabaseConfigured } from '@lib/supabase'
import { getProductivityStatus } from '@lib/categorization'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get('org_id') || ''
    const date = searchParams.get('date') || new Date().toISOString().slice(0,10)
    const departmentId = searchParams.get('department_id') || undefined
    const memberId = searchParams.get('member_id') || undefined
    if (!orgId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
    const { summaries, sessions } = await listDailyLogs({ orgId, date, memberId: memberId || undefined })
    const users = await listUsers(orgId)
    const departments = await listDepartments(orgId)
    const rules = await listOrgCategoryRules(orgId)
    const deptMap = new Map(departments.map(d => [d.id, d.name]))
    const userMap = new Map(users.map(u => [u.id, u]))
    const filteredUserIds = departmentId ? users.filter(u => u.departmentId === departmentId).map(u => u.id) : undefined
    const sb = isSupabaseConfigured() ? supabaseServer() : null
    let eventsAgg: Map<string, { active: number, productive: number, unproductive: number, idle: number, screenshots: number, topApps: {name:string, minutes:number, category:string}[], topUrls: {url:string, minutes:number, category:string}[] }> = new Map()
    if (sb) {
      const sessRows = sessions || []
      const byMember = new Map<string, string[]>(Object.entries(sessRows.reduce((acc: any, r: any) => { (acc[r.memberId] = acc[r.memberId] || []).push(r.id); return acc }, {}) || {}))
      const memberIds = filteredUserIds ? filteredUserIds : Array.from(byMember.keys())
      
      const sessIds = sessRows.map((r: any) => r.id)
      const { data: tsRows } = sessIds.length ? await sb!.from('tracking_sessions').select('id, member_id').in('time_session_id', sessIds) : { data: [] }
      
      const tsByMember = new Map<string, string[]>(Object.entries(tsRows?.reduce((acc: any, r: any) => { (acc[r.member_id] = acc[r.member_id] || []).push(r.id); return acc }, {}) || {}))
      const allTsIds = Array.from(tsByMember.values()).flat()
      const { data: evRows } = allTsIds.length ? await sb!.from('activity_events').select('*').in('tracking_session_id', allTsIds) : { data: [] }
      const { data: scRows } = allTsIds.length ? await sb!.from('screenshots').select('*').in('tracking_session_id', allTsIds) : { data: [] }
      for (const mId of memberIds) {
        const tsIds = tsByMember.get(mId) || []
        const rawEvents = (evRows || []).filter((e: any) => tsIds.includes(e.tracking_session_id))
        
        // Deduplicate events by minute to prevent overcounting (e.g. multiple tabs)
        const uniqueEventsMap = new Map<string, any>()
        for (const e of rawEvents) {
          const d = new Date(e.timestamp)
          // Create a unique key for this minute
          const key = `${d.toISOString().slice(0, 16)}` 
          
          if (!uniqueEventsMap.has(key)) {
            uniqueEventsMap.set(key, e)
          } else {
            const existing = uniqueEventsMap.get(key)
            // Logic to pick the "best" event for this minute
            // 1. Prefer Active over Idle
            if (!existing.is_active && e.is_active) {
                uniqueEventsMap.set(key, e)
            } 
            // 2. If both active, prefer Productive over Unproductive/Neutral
            else if (existing.is_active && e.is_active) {
                 const exProd = getProductivityStatus(existing.category || '', rules)
                 const newProd = getProductivityStatus(e.category || '', rules)
                 if (exProd !== 'productive' && newProd === 'productive') {
                     uniqueEventsMap.set(key, e)
                 }
            }
          }
        }
        const events = Array.from(uniqueEventsMap.values())

        const shots = (scRows || []).filter((s: any) => tsIds.includes(s.tracking_session_id))
        let active = 0, productive = 0, unproductive = 0, idle = 0
        const appMap = new Map<string, { minutes: number, category: string }>()
        const urlMap = new Map<string, { minutes: number, category: string }>()

        for (const e of events) {
          const prod = getProductivityStatus(e.category || '', rules)
          if (e.is_active) {
            active += 1
            const app = (e.app_name || 'Unknown').trim()
            const appEntry = appMap.get(app) || { minutes: 0, category: prod }
            appEntry.minutes += 1
            if (prod === 'productive') appEntry.category = 'productive'
            else if (prod === 'unproductive' && appEntry.category !== 'productive') appEntry.category = 'unproductive'
            appMap.set(app, appEntry)
            
            if (e.url) {
                let u = e.url
                try {
                    const parsed = new URL(e.url.startsWith('http') ? e.url : `https://${e.url}`)
                    u = parsed.hostname.replace(/^www\./, '')
                } catch {}
                const urlEntry = urlMap.get(u) || { minutes: 0, category: prod }
                urlEntry.minutes += 1
                if (prod === 'productive') urlEntry.category = 'productive'
                else if (prod === 'unproductive' && urlEntry.category !== 'productive') urlEntry.category = 'unproductive'
                urlMap.set(u, urlEntry)
            }
          } else {
            idle += 1
          }
          if (prod === 'productive') productive += 1
          if (prod === 'unproductive') unproductive += 1
        }
        
        const topApps = Array.from(appMap.entries())
            .filter(([name]) => name.toLowerCase() !== 'web' && name.toLowerCase() !== 'unknown')
            .sort((a,b)=> b[1].minutes - a[1].minutes)
            .slice(0, 5)
            .map(([name, data]) => ({ name, minutes: data.minutes, category: data.category }))
        const topUrls = Array.from(urlMap.entries()).sort((a,b)=> b[1].minutes - a[1].minutes).slice(0, 5).map(([url, data]) => ({ url, minutes: data.minutes, category: data.category }))
        
        eventsAgg.set(mId, { active, productive, unproductive, idle, screenshots: (shots || []).length, topApps, topUrls })
      }
    }
    const now = Date.now()

    // Collect all unique member IDs from summaries AND sessions
    const memberIdsFromSummaries = (summaries || []).map(s => s.memberId)
    const memberIdsFromSessions = (sessions || []).map((s: any) => s.memberId)
    const allMemberIds = Array.from(new Set([...memberIdsFromSummaries, ...memberIdsFromSessions]))
    
    // Filter by department/member filter if needed
    const relevantMemberIds = allMemberIds.filter(mid => 
      (filteredUserIds ? filteredUserIds.includes(mid) : true) &&
      (memberId ? mid === memberId : true)
    )

    const rows = relevantMemberIds.map(mid => {
      const u = userMap.get(mid)
      if (!u) return null

      // Find existing summary or create placeholder
      const s = (summaries || []).find(sum => sum.memberId === mid) || {
        memberId: mid,
        orgId,
        date,
        scheduledMinutes: 0,
        workedMinutes: 0,
        paidBreakMinutes: 0,
        unpaidBreakMinutes: 0,
        extraMinutes: 0,
        shortMinutes: 0,
        status: 'absent',
        isHoliday: false
      }

      const a = eventsAgg.get(mid) || { active: 0, productive: 0, unproductive: 0, idle: 0, screenshots: 0, topApps: [], topUrls: [] }
      
      // Real-time calculation
      const openSession = (sessions || []).find((sess: any) => sess.memberId === mid && sess.status === 'open')
      let worked = s.workedMinutes
      if (openSession) {
          const currentDuration = Math.max(0, (now - openSession.startTime) / 60000)
          worked += currentDuration
      }
  
      let status = s.status
      const scheduled = s.scheduledMinutes
      if (scheduled === 0) {
          status = worked > 0 ? 'normal' : 'unconfigured'
      } else if (worked === 0) {
          status = 'absent'
      } else if (worked > scheduled) {
          status = 'extra'
      } else if (worked < scheduled) {
          status = 'short'
      }
      if (s.isHoliday && status === 'absent') status = 'unconfigured'
  
      return {
        memberId: mid,
        memberName: `${u.firstName} ${u.lastName}`,
        departmentName: deptMap.get(u.departmentId || '') || '',
        date,
        workedHours: worked,
        trackedActiveMinutes: a.active,
        productiveMinutes: a.productive,
        unproductiveMinutes: a.unproductive,
        idleMinutes: a.idle,
        screenshots: a.screenshots,
        topApps: a.topApps || [],
        topUrls: a.topUrls || [],
        status: status
      }
    }).filter(Boolean)
    const totals = rows.reduce((acc: any, r: any) => { acc.tracked += r.trackedActiveMinutes; acc.productive += r.productiveMinutes; acc.unproductive += r.unproductiveMinutes; acc.idle += r.idleMinutes; acc.screenshots += r.screenshots; return acc }, { tracked: 0, productive: 0, unproductive: 0, idle: 0, screenshots: 0 })
    return NextResponse.json({ items: rows, totals })
  } catch (err: any) {
    console.error('Activity Overview Error:', err)
    return NextResponse.json({ error: err.message || 'INTERNAL_ERROR' }, { status: 500 })
  }
}

