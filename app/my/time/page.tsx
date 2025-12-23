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
type User = { id: string, firstName: string, lastName: string }

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
  const [summary, setSummary] = useState<any>({ today_hours: '00:00', extra_time: '+00:00', short_time: '-00:00', session_open: false, break_open: false, sessions: [], breaks: [] })
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
  useEffect(() => { if (orgId) loadMembers(orgId) }, [orgId])
  useEffect(() => { if (orgId && memberId) loadSummary(memberId, orgId) }, [orgId, memberId])
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
    const res = await fetch('/api/time/start', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, member_id: memberId, source: 'web' }) })
    // if (res.status === 403) {
    //   const d = await res.json()
    //   if (d.error === 'CHECKIN_COOLDOWN') {
    //     alert('You cannot check in again within 12 hours of your last session.')
    //     setUiStarting(false)
    //     setUiSessionOpen(false)
    //     return
    //   }
    // }
    await beginTracking()
    await loadSummary(memberId, orgId)
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
  const startBreak = async () => {
    if (!orgId || !memberId) return
    await fetch('/api/time/break/start', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, member_id: memberId, label: 'Break' }) })
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
      <div className="grid grid-3">
        <GlassCard title="Today's Hours">
          <div className="grid grid-2" style={{marginBottom:12}}>
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
          <div className="grid grid-3" style={{marginBottom:12}}>
            <div>
              <div className="subtitle">Worked</div>
              <div className="title">{summary.today_hours}</div>
            </div>
            <div>
              <div className="subtitle">Live Clock</div>
              <div className="title">{clockStart ? fmtClock(elapsedMs) : '00:00:00'}</div>
            </div>
            <div>
              <div className="subtitle">Extra</div>
              <div className="title" style={{color:'var(--green)'}}>{summary.extra_time}</div>
            </div>
            <div>
              <div className="subtitle">Short</div>
              <div className="title" style={{color:'var(--orange)'}}>{summary.short_time}</div>
            </div>
          </div>
          <div className="row" style={{gap:12}}>
            {!uiSessionOpen ? (
              <GlassButton variant="primary" onClick={startDay}>Start Day</GlassButton>
            ) : (
              <GlassButton variant="secondary" onClick={endDay}>End Day</GlassButton>
            )}
          </div>
        </GlassCard>
        <GlassCard title="Extra Time">
          <div className="title" style={{color:'var(--green)'}}>{summary.extra_time}</div>
        </GlassCard>
        <GlassCard title="Short Time">
          <div className="title" style={{color:'var(--orange)'}}>{summary.short_time}</div>
        </GlassCard>
      </div>

      <div className="grid grid-2" style={{marginTop:24}}>
        <GlassCard title="Take Break">
          <div className="row" style={{gap:12}}>
            {!summary.break_open ? (
              <GlassButton onClick={startBreak}>Take Break</GlassButton>
            ) : (
              <GlassButton onClick={endBreak}>End Break</GlassButton>
            )}
          </div>
        </GlassCard>
      </div>

      <div className="grid" style={{marginTop:24}}>
        <GlassCard title="Today's Sessions">
          <div className="subtitle">Sessions</div>
          <table className="glass-table">
            <thead>
              <tr>
                <th>Session Start</th>
                <th>Session End</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(summary.sessions||[]).map((s: any) => (
                <tr key={s.id}>
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
