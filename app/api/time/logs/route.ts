import { NextRequest, NextResponse } from 'next/server'
import { listDailyLogs, listAllOrgMembers, listDepartments, listTeamMemberIds, listOrgCategoryRules } from '@/lib/db'
import { supabaseServer, isSupabaseConfigured } from '@/lib/supabase'
import { getProductivityStatus } from '@/lib/categorization'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const date = searchParams.get('date') || ''
  
  // New filters
  const memberId = searchParams.get('member_id') || searchParams.get('memberId') || undefined
  const departmentId = searchParams.get('department_id') || searchParams.get('departmentId') || undefined
  const managerId = searchParams.get('manager_id') || searchParams.get('managerId') || undefined
  const memberRoleId = searchParams.get('member_role_id') || searchParams.get('memberRoleId') || undefined
  const userIds = searchParams.get('userIds')?.split(',').filter(Boolean)
  const q = searchParams.get('q') // For app/website search
  const statusFilter = searchParams.get('status')
  
  const projectId = searchParams.get('projectId') || searchParams.get('project_id')
  const clientId = searchParams.get('clientId') || searchParams.get('client_id')
  const idleGt = parseInt(searchParams.get('idle_gt') || '0')
  const missingScreenshots = searchParams.get('missing_screenshots') === 'true'
  const sort = searchParams.get('sort')
  
  if (!orgId || !date) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  
  let allowedMemberId = memberId || undefined
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const actor = req.headers.get('x-user-id') || ''
  
  if (role === 'manager' && actor) {
    const team = await listTeamMemberIds(orgId, actor)
    if (allowedMemberId && !team.includes(allowedMemberId)) allowedMemberId = undefined
    // If filtering by multiple userIds, ensure all are in team
    if (userIds) {
       // We will filter userIds later to intersect with team
    }
  }

  // Pass basic filters to listDailyLogs
  const data = await listDailyLogs({ orgId, date, memberId: allowedMemberId || undefined })
  
  const users = await listAllOrgMembers(orgId)
  const departments = await listDepartments(orgId)
  const deptMap = new Map(departments.map(d => [d.id, d.name]))
  const userMap = new Map(users.map(u => [u.id, { 
    name: `${u.firstName} ${u.lastName}`, 
    email: u.email,
    departmentId: u.departmentId || '', 
    managerId: u.managerId || '', 
    memberRoleId: u.memberRoleId || '' 
  }]))

  // Filter sessions
  let filteredSessions = data.sessions || []

  // 1. User/Dept filters
  if (userIds && userIds.length > 0) {
    filteredSessions = filteredSessions.filter((s: any) => userIds.includes(s.memberId))
  }
  if (allowedMemberId) {
    filteredSessions = filteredSessions.filter((s: any) => s.memberId === allowedMemberId)
  }
  if (departmentId) {
    filteredSessions = filteredSessions.filter((s: any) => {
      const u = userMap.get(s.memberId)
      return u && u.departmentId === departmentId
    })
  }

  // 2. Project/Client filters
  if (projectId) {
    filteredSessions = filteredSessions.filter((s: any) => s.projectId === projectId || s.project_id === projectId || (s.projects && s.projects.id === projectId))
  }
  if (clientId) {
    filteredSessions = filteredSessions.filter((s: any) => {
      const p = s.projects
      const c = p?.clients
      return c?.id === clientId || s.client_id === clientId
    })
  }

  // 3. Status filter
  if (statusFilter) {
    filteredSessions = filteredSessions.filter((s: any) => s.status === statusFilter)
  }

  // 4. Idle / Screenshots / App Search (Requires Events)
  // Only fetch events if needed for filtering or if we want to return stats
  // For now, let's fetch if filters are present OR just to be safe (it's single day)
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  const rules = await listOrgCategoryRules(orgId)

  // Attach stats to sessions
  const sessionsWithStats = await Promise.all(filteredSessions.map(async (s: any) => {
    let idleMinutes = 0
    let screenshotCount = 0
    let hasMatch = true // For q filter

    if (sb) {
      // Fetch tracking sessions for this time session
      const { data: tsRows } = await sb.from('tracking_sessions').select('id').eq('time_session_id', s.id)
      const tsIds = (tsRows || []).map((t: any) => t.id)
      
      if (tsIds.length > 0) {
        // Fetch events and screenshots
        const [evRes, scRes] = await Promise.all([
           sb.from('activity_events').select('*').in('tracking_session_id', tsIds),
           sb.from('screenshots').select('id', { count: 'exact', head: true }).in('tracking_session_id', tsIds)
        ])
        
        const events = evRes.data || []
        screenshotCount = scRes.count || 0

        // Calculate idle
        // Deduplicate events by minute
        const uniqueEventsMap = new Map<string, any>()
        for (const e of events) {
            const d = new Date(e.timestamp)
            const key = `${d.toISOString().slice(0, 16)}`
            if (!uniqueEventsMap.has(key)) {
                uniqueEventsMap.set(key, e)
            } else {
                const existing = uniqueEventsMap.get(key)
                if (!existing.is_active && e.is_active) uniqueEventsMap.set(key, e)
            }
        }
        const uniqueEvents = Array.from(uniqueEventsMap.values())
        idleMinutes = uniqueEvents.filter(e => !e.is_active).length

        // Check q (app/website name)
        if (q) {
           const match = uniqueEvents.some(e => 
             (e.app_name && e.app_name.toLowerCase().includes(q.toLowerCase())) ||
             (e.url && e.url.toLowerCase().includes(q.toLowerCase()))
           )
           if (!match) hasMatch = false
        }
      }
    }
    
    return { ...s, idleMinutes, screenshotCount, hasMatch }
  }))

  // Apply "Heavy" filters
  let finalSessions = sessionsWithStats

  if (q) {
    finalSessions = finalSessions.filter(s => s.hasMatch)
  }
  if (idleGt > 0) {
    finalSessions = finalSessions.filter(s => s.idleMinutes > idleGt)
  }
  if (missingScreenshots) {
    finalSessions = finalSessions.filter(s => s.screenshotCount === 0 && (s.totalMinutes || 0) > 10)
  }

  // Sort
  if (sort) {
    const [field, dir] = sort.split(':')
    const m = dir === 'desc' ? -1 : 1
    finalSessions.sort((a, b) => {
      if (field === 'startTime') return (new Date(a.startTime).getTime() - new Date(b.startTime).getTime()) * m
      if (field === 'duration') return ((a.totalMinutes || 0) - (b.totalMinutes || 0)) * m
      if (field === 'idle') return (a.idleMinutes - b.idleMinutes) * m
      return 0
    })
  } else {
    // Default sort: newest first
    finalSessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
  }
  
  const now = Date.now()
  let items = (data.summaries || []).map(s => {
    // Check for open session to add real-time duration
    const openSession = (data.sessions || []).find((sess: any) => sess.memberId === s.memberId && sess.status === 'open')
    
    // Reconstruct total worked time because workedMinutes might be capped at scheduled in DB
    let totalWorked = s.workedMinutes + (s.extraMinutes || 0)
    if (openSession) {
      const currentDuration = Math.max(0, (now - openSession.startTime) / 60000)
      totalWorked += currentDuration
    }
    
    // Recalculate status/extra/short based on new worked time
    const scheduled = s.scheduledMinutes
    let extra = 0
    let short = 0
    let workedDisplay = totalWorked
    let status = s.status

    if (scheduled === 0) {
      status = totalWorked > 0 ? 'normal' : 'unconfigured'
    } else if (totalWorked === 0) {
      status = 'absent'
    } else if (totalWorked > scheduled) {
      status = 'extra'
      extra = totalWorked - scheduled
      workedDisplay = scheduled
    } else if (totalWorked < scheduled) {
      status = 'short'
      short = scheduled - totalWorked
    }
    
    // Holiday logic override from db.ts recomputeDaily
    if (s.isHoliday && status === 'absent') status = 'unconfigured'

    const u = userMap.get(s.memberId)
    return {
      ...s,
      workedMinutes: workedDisplay,
      extraMinutes: extra,
      shortMinutes: short,
      status,
      memberName: u?.name || 'Unknown',
      departmentName: deptMap.get(u?.departmentId || '') || ''
    }
  })

  // Filter items (summaries)
  // We apply the same User/Dept filters to items for consistency
  if (userIds && userIds.length > 0) items = items.filter(it => userIds.includes(it.memberId))
  if (allowedMemberId) items = items.filter(it => it.memberId === allowedMemberId)
  if (departmentId) items = items.filter(it => (userMap.get(it.memberId)?.departmentId || '') === departmentId)
  
  // Return filtered sessions and items
  // Note: breaks are not filtered in the new logic yet, let's filter them based on finalSessions
  const finalSessionIds = finalSessions.map(s => s.id)
  const breaks = (data.breaks || []).filter((b: any) => finalSessionIds.includes(b.timeSessionId))

  return NextResponse.json({ 
    items, 
    sessions: finalSessions,
    breaks
  })
}
