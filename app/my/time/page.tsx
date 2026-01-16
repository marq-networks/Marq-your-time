"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import GlassModal from '@components/ui/GlassModal'
import { normalizeRoleForApi } from '@lib/permissions'
import { useTracking } from '@components/TrackingProvider'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string, salary?: number, workingHoursPerDay?: number, workingDays?: string[] }

function formatHM(mins: number) {
  const m = Math.max(0, Math.round(mins || 0))
  const h = Math.floor(m / 60)
  const mm = String(m % 60).padStart(2,'0')
  return `${h}:${mm}`
}

export default function MyDayPage() {
  const tracking = useTracking()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [members, setMembers] = useState<User[]>([])
  const [memberId, setMemberId] = useState('')
  const [projects, setProjects] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [myTasks, setMyTasks] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [summary, setSummary] = useState<any>({ today_hours: '00:00', extra_time: '+00:00', short_time: '-00:00', session_open: false, break_open: false, sessions: [], breaks: [], attendance: null })
  const [role, setRole] = useState('')
  const [consentOpen, setConsentOpen] = useState(false)
  const [consentText, setConsentText] = useState('')
  const [tempTrackingId, setTempTrackingId] = useState<string | null>(null)
  const [consentStatus, setConsentStatus] = useState<'unknown'|'granted'|'denied'>('unknown')
  const [clockStart, setClockStart] = useState<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [clockTimer, setClockTimer] = useState<any>(null)
  const [uiSessionOpen, setUiSessionOpen] = useState(false)
  const [uiStarting, setUiStarting] = useState(false)
  const [uiEnding, setUiEnding] = useState(false)

  const loadOrgs = async () => {
    const endpoint = role === 'super_admin' ? '/api/org/list' : '/api/orgs/my'
    const res = await fetch(endpoint, { cache: 'no-store' })
    const data = await res.json()
    const items: Org[] = Array.isArray(data.items) ? (data.items as Org[]) : []
    setOrgs(items)
    if (!orgId && items.length) {
      const cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
      const preferred = items.find(o => o.id === cookieOrgId)?.id || items[0].id
      setOrgId(preferred)
    }
  }
  const loadMembers = async (oid: string) => {
    if (!oid) return
    const res = await fetch(`/api/user/list?orgId=${oid}`, { cache: 'no-store' })
    const data = await res.json()
    setMembers(data.items || [])
    if (!memberId && data.items?.length) {
      const cookieUserId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_user_id='))?.split('=')[1] || '') : ''
      const preferredMember = (data.items as any[]).find(m => m.id === cookieUserId)?.id || data.items[0].id
      setMemberId(preferredMember)
    }
  }
  const loadProjects = async (oid: string) => {
    if (!oid) return
    const res = await fetch(`/api/projects/list?org_id=${oid}`, { cache: 'no-store' })
    const data = await res.json()
    setProjects(data.items || [])
  }
  const loadTasks = async (pid: string) => {
    if (!pid) { setTasks([]); return }
    const res = await fetch(`/api/tasks/list?project_id=${pid}`, { cache: 'no-store' })
    const data = await res.json()
    setTasks(data.items || [])
  }
  const loadMyTasks = async (mid: string, oid: string) => {
    if (!mid || !oid) { setMyTasks([]); return }
    const res = await fetch(`/api/tasks/my?member_id=${mid}&org_id=${oid}`, { cache: 'no-store' })
    const data = await res.json()
    setMyTasks(data.items || [])
  }
  const loadSummary = async (mid: string, oid: string) => {
    if (!mid || !oid) return
    const res = await fetch(`/api/time/today?member_id=${mid}&org_id=${oid}`, { cache: 'no-store' })
    const data = await res.json()
    setSummary((prev: any) => {
      if (!data.session_open && uiSessionOpen) {
        const open = { id: 'local', startTime: clockStart || Date.now(), endTime: null, totalMinutes: 0 }
        return { ...data, session_open: true, sessions: [open, ...(data.sessions || [])] }
      }
      return data
    })
  }

  useEffect(() => { try { const r = normalizeRoleForApi((typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : '')); setRole(r) } catch {} }, [])
  useEffect(() => { loadOrgs() }, [role])
  useEffect(() => { if (orgId) { loadMembers(orgId); loadProjects(orgId); loadBreakTypes(orgId) } }, [orgId])
  useEffect(() => { if (selectedProjectId) loadTasks(selectedProjectId); else setTasks([]) }, [selectedProjectId])
  useEffect(() => { if (orgId && memberId) { loadSummary(memberId, orgId); loadMyTasks(memberId, orgId) } }, [orgId, memberId])
  useEffect(() => {
    if (uiStarting || uiEnding) return
    setUiSessionOpen(!!summary.session_open)
  }, [summary.session_open, uiStarting, uiEnding])

  const startDay = async () => {
    if (!orgId || !memberId) return
    setUiStarting(true)
    setUiSessionOpen(true)
    setSummary((prev: any) => {
      const open = { id: 'local', startTime: Date.now(), endTime: null, totalMinutes: 0 }
      return { ...prev, session_open: true, sessions: [open, ...(prev.sessions || [])] }
    })
    startClock()
    const res = await fetch('/api/time/start', { 
      method:'POST', 
      headers:{'Content-Type':'application/json'}, 
      body: JSON.stringify({ 
        org_id: orgId, 
        member_id: memberId, 
        source: 'web',
        project_id: selectedProjectId,
        task_id: selectedTaskId
      }) 
    })
    const data = await res.json()
    if (!res.ok) {
      if (data && data.error === 'ALREADY_CHECKED_IN_TODAY') {
        alert('You have already clocked in today.')
      } else if (data && data.error === 'CHECKIN_COOLDOWN') {
        alert('You cannot check in again within 12 hours of your last session.')
      } else {
        alert('Unable to start your work session.')
      }
      setUiStarting(false)
      setUiSessionOpen(false)
      stopClock()
      loadSummary(memberId, orgId)
      return
    }
    await beginTracking()
    await loadSummary(memberId, orgId)
    try {
      const attRes = await fetch(`/api/time/today?member_id=${memberId}&org_id=${orgId}`, { cache: 'no-store' })
      const attData = await attRes.json()
      setSummary(attData)
      if (attData.attendance && attData.attendance.status === 'late') {
        const shift = attData.attendance.shiftStartTime ? new Date(attData.attendance.shiftStartTime).toLocaleTimeString() : ''
        const msg = shift ? `You are clocking in late. Shift start time was ${shift}.` : 'You are clocking in after your scheduled shift start time.'
        alert(msg)
      }
    } catch {}
    setUiStarting(false)
  }
  const endDay = async () => {
    if (!orgId || !memberId) return
    setUiEnding(true)
    setUiSessionOpen(false)
    setSummary((prev: any) => {
      const idx = (prev.sessions || []).findIndex((s: any) => !s.endTime)
      const sessions = idx >= 0 ? (prev.sessions || []).map((s: any, i: number) => (i === idx ? { ...s, endTime: Date.now() } : s)) : (prev.sessions || [])
      return { ...prev, session_open: false, sessions }
    })
    stopClock()
    await fetch('/api/time/stop', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, member_id: memberId }) })
    await tracking.stopTracking()
    for (let i = 0; i < 6; i++) {
      const res = await fetch(`/api/time/today?member_id=${memberId}&org_id=${orgId}`, { cache: 'no-store' })
      const data = await res.json()
      setSummary(data)
      if (!data.session_open) break
      await new Promise(r => setTimeout(r, 500))
    }
    setUiEnding(false)
  }
  const [breakTypes, setBreakTypes] = useState<any[]>([])
  const [selectedBreakTypeId, setSelectedBreakTypeId] = useState<string>('')
  const defaultBreakTypes = [
    { id: 'coffee', name: 'Coffee Break' },
    { id: 'lunch', name: 'Lunch Break' },
    { id: 'short', name: 'Short Break' }
  ]

  const loadBreakTypes = async (org: string) => {
    try {
      const res = await fetch(`/api/time/break/types?org_id=${org}`, { cache: 'no-store' })
      if (!res.ok) {
        setBreakTypes(defaultBreakTypes)
        if (!selectedBreakTypeId && defaultBreakTypes.length) {
          setSelectedBreakTypeId(defaultBreakTypes[0].id)
        }
        return
      }
      const data = await res.json()
      const items = Array.isArray(data.items) ? data.items : []
      if (items.length) {
        setBreakTypes(items)
        if (!selectedBreakTypeId) {
          setSelectedBreakTypeId(items[0].id)
        }
      } else {
        setBreakTypes(defaultBreakTypes)
        if (!selectedBreakTypeId && defaultBreakTypes.length) {
          setSelectedBreakTypeId(defaultBreakTypes[0].id)
        }
      }
    } catch {
      setBreakTypes(defaultBreakTypes)
      if (!selectedBreakTypeId && defaultBreakTypes.length) {
        setSelectedBreakTypeId(defaultBreakTypes[0].id)
      }
    }
  }

  const startBreak = async () => {
    if (!orgId || !memberId) return
    const source = breakTypes.length ? breakTypes : defaultBreakTypes
    const selectedType = source.find((t: any) => t.id === selectedBreakTypeId) || source[0]
    const label = selectedType ? selectedType.name : 'Break'
    const payload: any = { org_id: orgId, member_id: memberId, label }
    await fetch('/api/time/break/start', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    loadSummary(memberId, orgId)
  }
  const endBreak = async () => {
    if (!orgId || !memberId) return
    await fetch('/api/time/break/stop', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, member_id: memberId }) })
    loadSummary(memberId, orgId)
  }

  const beginTracking = async () => {
    if (!orgId || !memberId) return
    await fetch('/api/privacy/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, member_id: memberId, allow_activity_tracking: true, allow_screenshots: true, mask_personal_windows: true }) })
    const res = await fetch('/api/tracking/start', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, member_id: memberId }) })
    const data = await res.json()
    if (data.trackingAllowed && data.trackingSessionId) {
      if (data.consentRequired) {
        setTempTrackingId(data.trackingSessionId)
        setConsentText(String(data.consentText || ''))
        setConsentOpen(true)
      } else {
        setConsentStatus('granted')
        try { localStorage.setItem(`marq_consent_${orgId}_${memberId}`, 'granted') } catch {}
        // Get settings to know if screenshots enabled
        const s = await fetch(`/api/activity/today?member_id=${memberId}&org_id=${orgId}`, { cache:'no-store' }).then(r=>r.json())
        await tracking.startTracking(data.trackingSessionId, s.settings)
      }
    }
  }

  const acceptConsent = async () => {
    if (!tempTrackingId) { setConsentOpen(false); return }
    const res = await fetch('/api/tracking/consent', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ tracking_session_id: tempTrackingId, accepted: true, consent_text: consentText }) })
    const data = await res.json()
    if (!data.allowed) { setConsentOpen(false); return }
    setConsentStatus('granted')
    try { localStorage.setItem(`marq_consent_${orgId}_${memberId}`, 'granted') } catch {}
    setUiSessionOpen(true)
    startClock()
    const s = await fetch(`/api/activity/today?member_id=${memberId}&org_id=${orgId}`, { cache:'no-store' }).then(r=>r.json())
    await tracking.startTracking(tempTrackingId, s.settings)
    setConsentOpen(false)
  }

  const rejectConsent = async () => {
    if (!tempTrackingId) { setConsentOpen(false); return }
    await fetch('/api/tracking/consent', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ tracking_session_id: tempTrackingId, accepted: false, consent_text: consentText }) })
    setConsentStatus('denied')
    try { localStorage.setItem(`marq_consent_${orgId}_${memberId}`, 'denied') } catch {}
    await tracking.stopTracking()
    setConsentOpen(false)
  }

  // No useEffect cleanup for tracking here - handled by Provider or explicit Stop
  
  const startClock = () => {
    const open = (summary.sessions||[]).find((s:any)=>!s.endTime)
    const base = open ? Number(open.startTime) : Date.now()
    setClockStart(base)
    if (clockTimer) clearInterval(clockTimer)
    const t = setInterval(() => {
      setElapsedMs(Math.max(0, Date.now() - base))
    }, 1000)
    setClockTimer(t)
  }
  const stopClock = () => {
    if (clockTimer) { clearInterval(clockTimer); setClockTimer(null) }
    setClockStart(null)
    setElapsedMs(0)
  }
  useEffect(() => {
    const open = (summary.sessions||[]).find((s:any)=>!s.endTime)
    if (summary.session_open && open) {
      setClockStart(Number(open.startTime))
      if (!clockTimer) startClock()
    } else {
      stopClock()
    }
  }, [summary.session_open, JSON.stringify(summary.sessions||[])])
  const fmtClock = (ms: number) => {
    const total = Math.floor(ms/1000)
    const h = Math.floor(total/3600)
    const m = Math.floor((total%3600)/60)
    const s = total%60
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  // Earnings calculation
   const currentUser = members.find(m => m.id === memberId)
   const monthlySalary = currentUser?.salary || 0
   const workingHours = currentUser?.workingHoursPerDay || 8
   const perMinuteRate = monthlySalary > 0 ? monthlySalary / (26 * workingHours * 60) : 0
   
   const sessionsMs = (summary.sessions || []).reduce((acc: number, s: any) => {
     if (s.endTime) return acc + (s.endTime - s.startTime)
     return acc
   }, 0) + (clockStart ? elapsedMs : 0)

   const breaksMs = (summary.breaks || []).reduce((acc: number, b: any) => {
     if (!b.isPaid && b.endTime) return acc + (b.endTime - b.startTime)
     return acc
   }, 0)

   const totalWorkedMs = Math.max(0, sessionsMs - breaksMs)
  // Ensure we don't show impossibly large numbers if dates are messed up
  const safeWorkedMs = (totalWorkedMs > 86400000) ? 0 : totalWorkedMs
  const totalMinutes = safeWorkedMs / 60000
  const earnings = (safeWorkedMs / 60000) * perMinuteRate
  const todayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()]
  const workingDays = Array.isArray((currentUser as any)?.workingDays) ? (currentUser as any).workingDays as string[] : []
  const scheduledMinutes = workingDays.includes(todayName) ? workingHours * 60 : 0
  const liveExtraMinutes = Math.max(0, totalMinutes - scheduledMinutes)
  const overtimeDisplay = summary.session_open && scheduledMinutes > 0 ? `+${formatHM(liveExtraMinutes)}` : summary.extra_time
  const [showOvertimeWarning, setShowOvertimeWarning] = useState(false)
  const [showLimitWarning, setShowLimitWarning] = useState(false)

  useEffect(() => {
    // 8 hours = 480 mins, 12 hours = 720 mins
    if (totalMinutes >= 720 && !showLimitWarning) setShowLimitWarning(true)
    else if (totalMinutes >= 480 && !showOvertimeWarning && !showLimitWarning) setShowOvertimeWarning(true)
  }, [totalMinutes, showOvertimeWarning, showLimitWarning])

  if (role && !['employee','member'].includes(role)) {
    return (
      <AppShell title="My Day">
        <div style={{display:'grid',placeItems:'center',height:'60vh'}}>
          <div className="glass-panel" style={{padding:24,borderRadius:'var(--radius-large)'}}>
            <div className="title">Access Denied</div>
            <div className="subtitle">This page is only available to employees.</div>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="My Day">
      {showOvertimeWarning && (
        <div className="glass-panel" style={{marginBottom:16, padding:16, background:'rgba(255,165,0,0.15)', border:'1px solid rgba(255,165,0,0.3)', color:'#FFC107', display:'flex', alignItems:'center', gap:12}}>
          <div style={{fontSize:20}}>⚠️</div>
          <div>You have exceeded 8 hours of work today. You are now in overtime.</div>
          <GlassButton variant="secondary" onClick={()=>setShowOvertimeWarning(false)} style={{marginLeft:'auto', height:32, fontSize:12}}>Dismiss</GlassButton>
        </div>
      )}
      {showLimitWarning && (
        <div className="glass-panel" style={{marginBottom:16, padding:16, background:'rgba(255,59,48,0.15)', border:'1px solid rgba(255,59,48,0.3)', color:'#FF3B30', display:'flex', alignItems:'center', gap:12}}>
          <div style={{fontSize:20}}>🛑</div>
          <div><strong>Maximum Limit Reached:</strong> You have worked over 12 hours today. Please end your day immediately.</div>
        </div>
      )}
      <div className="grid grid-2" style={{marginBottom: 24}}>
          <div>
            <div className="label">Organization</div>
            {(['employee','member'].includes(role)) ? (
              <span className="tag-pill">{orgs.find(o=>o.id===orgId)?.orgName || orgs[0]?.orgName || ''}</span>
            ) : (
              <GlassSelect value={orgId} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setOrgId(e.target.value)}>
                <option value="">Select org</option>
                {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
              </GlassSelect>
            )}
          </div>
          <div>
            <div className="label">Me</div>
            {(['employee','member'].includes(role)) ? (
              <span className="tag-pill">{members.find(m=>m.id===memberId) ? `${members.find(m=>m.id===memberId)!.firstName} ${members.find(m=>m.id===memberId)!.lastName}` : 'Me'}</span>
            ) : (
              <GlassSelect value={memberId} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setMemberId(e.target.value)}>
                <option value="">Select member</option>
                {members.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
              </GlassSelect>
            )}
          </div>
      </div>

      <div className="grid grid-3" style={{gap: 24, marginBottom: 24}}>
        <GlassCard title="Worked Today">
          <div className="title" style={{fontSize: '2.5rem', fontWeight: 700}}>{fmtClock(safeWorkedMs)}</div>
          <div className="subtitle">Total worked time</div>
        </GlassCard>
        
        <GlassCard title="Live Clock">
           <div className="title" style={{fontSize: '2.5rem', fontWeight: 700, color: uiSessionOpen ? 'var(--primary)' : 'inherit'}}>
             {clockStart ? fmtClock(Math.min(elapsedMs, 86400000)) : '00:00:00'}
           </div>
           <div className="subtitle">{uiSessionOpen ? 'Session Active' : 'Session Inactive'}</div>
           {!uiSessionOpen && (
             <div style={{display:'flex', gap:8, marginTop:12}}>
               <div style={{flex:1}}>
                  <GlassSelect value={selectedProjectId} onChange={(e:any)=>setSelectedProjectId(e.target.value)}>
                    <option value="">Select Project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </GlassSelect>
               </div>
               <div style={{flex:1}}>
                  <GlassSelect value={selectedTaskId} onChange={(e:any)=>setSelectedTaskId(e.target.value)} disabled={!selectedProjectId}>
                    <option value="">Select Task</option>
                    {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </GlassSelect>
               </div>
             </div>
           )}
           <div style={{marginTop: 16}}>
             {!uiSessionOpen ? (
                <GlassButton variant="primary" onClick={startDay} style={{width: '100%'}}>Start Day</GlassButton>
              ) : (
                <GlassButton variant="secondary" onClick={endDay} style={{width: '100%'}}>End Day</GlassButton>
              )}
           </div>
        </GlassCard>

        <GlassCard title="My Earnings">
          <div className="title" style={{fontSize: '2.5rem', fontWeight: 700, color: 'var(--green)'}}>
             {earnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="subtitle">Calculated real-time</div>
        </GlassCard>
      </div>

      <div className="grid grid-2" style={{marginBottom: 24}}>
         <GlassCard title="Time Status">
           <div className="grid grid-2">
             <div>
              <div className="subtitle">Overtime</div>
              <div className="title" style={{color:'var(--green)'}}>{overtimeDisplay}</div>
            </div>
             <div>
               <div className="subtitle">Short Time</div>
               <div className="title" style={{color:'var(--orange)'}}>{summary.short_time}</div>
             </div>
           </div>
         </GlassCard>
         
         <GlassCard title="Actions">
           <div className="subtitle" style={{marginBottom: 12}}>Break Management</div>
           <div className="grid grid-3" style={{gap:12, marginBottom: 12}}>
             {(breakTypes.length ? breakTypes : defaultBreakTypes).map((t: any) => {
               const isSelected = t.id === selectedBreakTypeId
               const code = String(t.code || t.id || '').toLowerCase()
               const icon = code.includes('coffee') ? '☕' : code.includes('lunch') ? '🍽' : '⏱'
               return (
                 <button
                   key={t.id}
                   type="button"
                   onClick={() => setSelectedBreakTypeId(t.id)}
                   style={{
                     borderRadius: 20,
                     border: isSelected ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.25)',
                     background: isSelected ? 'linear-gradient(135deg, var(--primary), #39FF14)' : 'rgba(255,255,255,0.05)',
                     padding: 12,
                     display: 'flex',
                     flexDirection: 'column',
                     alignItems: 'flex-start',
                     gap: 6,
                     cursor: 'pointer',
                     boxShadow: isSelected ? '0 0 0 1px rgba(57,255,20,0.25), 0 12px 30px rgba(0,0,0,0.35)' : '0 8px 24px rgba(0,0,0,0.25)',
                     color: isSelected ? '#000' : 'inherit',
                     minHeight: 80
                   }}
                 >
                   <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%'}}>
                     <div style={{fontSize:24}}>{icon}</div>
                     {isSelected && (
                       <span className="badge" style={{background:'rgba(0,0,0,0.35)',borderRadius:999,padding:'2px 8px',fontSize:11}}>
                         Selected
                       </span>
                     )}
                   </div>
                   <div style={{fontWeight:600,fontSize:14}}>{t.name}</div>
                   {t.description && (
                     <div className="subtitle" style={{fontSize:12,opacity:0.8}}>{t.description}</div>
                   )}
                 </button>
               )
             })}
           </div>
           <div className="row" style={{gap:12}}>
             {!summary.break_open ? (
               <GlassButton onClick={startBreak} disabled={!uiSessionOpen}>Take Break</GlassButton>
             ) : (
               <GlassButton onClick={endBreak}>End Break</GlassButton>
             )}
           </div>
        </GlassCard>
      </div>

      <div className="grid" style={{marginBottom: 24}}>
        <GlassCard title="My Tasks">
          <table className="glass-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Project</th>
                <th>Status</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {myTasks.map((t: any) => (
                <tr key={t.id}>
                  <td>{t.title}</td>
                  <td>{projects.find(p => p.id === t.projectId)?.name || '-'}</td>
                  <td>
                    <GlassSelect
                      value={t.status || 'todo'}
                      onChange={async (e: any) => {
                        const newStatus = e.target.value
                        if (!newStatus || newStatus === t.status) return
                        const res = await fetch('/api/tasks/update', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: t.id, status: newStatus })
                        })
                        if (!res.ok) {
                          alert('Failed to update task status')
                          return
                        }
                        const data = await res.json()
                        const updated = data.task || {}
                        setMyTasks((prev: any[]) =>
                          (prev || []).map(task =>
                            task.id === t.id ? { ...task, status: updated.status || newStatus } : task
                          )
                        )
                      }}
                    >
                      <option value="todo">Todo</option>
                      <option value="in_progress">In Progress</option>
                      <option value="review">Review</option>
                      <option value="done">Done</option>
                    </GlassSelect>
                  </td>
                  <td>{t.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      </div>

      <div className="grid">
        <GlassCard title="Today's Sessions">
          <div className="subtitle">Sessions</div>
          <table className="glass-table">
            <thead>
              <tr>
                <th>Project / Task</th>
                <th>Session Start</th>
                <th>Session End</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(summary.sessions||[]).map((s: any) => (
                <tr key={s.id}>
                  <td>
                    {s.projectName ? (
                      <div>
                        <div style={{fontWeight:600}}>{s.projectName}</div>
                        {s.taskTitle && <div style={{fontSize:'0.8em', opacity:0.7}}>{s.taskTitle}</div>}
                      </div>
                    ) : <span style={{opacity:0.5}}>-</span>}
                  </td>
                  <td>{new Date(s.startTime).toLocaleTimeString()}</td>
                  <td>{s.endTime ? new Date(s.endTime).toLocaleTimeString() : '...'}</td>
                  <td>{formatHM(s.totalMinutes || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="subtitle" style={{marginTop:16}}>Breaks</div>
          <table className="glass-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Start</th>
                <th>End</th>
                <th>Minutes</th>
                <th>Paid</th>
              </tr>
            </thead>
            <tbody>
              {(summary.breaks||[]).map((b: any) => (
                <tr key={b.id}>
                  <td>{b.label}</td>
                  <td>{new Date(b.startTime).toLocaleTimeString()}</td>
                  <td>{b.endTime ? new Date(b.endTime).toLocaleTimeString() : '...'}</td>
                  <td>{formatHM(b.totalMinutes || 0)}</td>
                  <td>{b.isPaid ? 'Paid' : 'Unpaid'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      </div>
      <GlassModal open={consentOpen} onClose={()=>setConsentOpen(false)} title="Activity Tracking">
        <div className="subtitle">{consentText}</div>
        <div className="row" style={{ justifyContent:'flex-end', gap:8, marginTop:12 }}>
          <GlassButton onClick={rejectConsent}>Decline</GlassButton>
          <GlassButton variant="primary" onClick={acceptConsent} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Allow</GlassButton>
        </div>
      </GlassModal>
    </AppShell>
  )
}
