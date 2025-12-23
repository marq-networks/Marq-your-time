"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import GlassModal from '@components/ui/GlassModal'
import usePermission from '@lib/hooks/usePermission'
import { useTracking } from '@components/TrackingProvider'

export default function DashboardClient() {
  const tracking = useTracking()
  const canOrg = usePermission('manage_org').allowed
  const [orgs, setOrgs] = useState<{ id: string, orgName: string }[]>([])
  const [orgId, setOrgId] = useState('')
  const [members, setMembers] = useState<{ id: string, firstName: string, lastName: string }[]>([])
  const [memberId, setMemberId] = useState('')
  const [summary, setSummary] = useState<any>({ today_hours:'0:00', extra_time:'+00:00', short_time:'-00:00', session:null, break:null, sessions:[], breaks:[] })
  const [mounted, setMounted] = useState(false)
  const [role, setRole] = useState('')
  const [consentOpen, setConsentOpen] = useState(false)
  const [consentText, setConsentText] = useState('')
  const [tempTrackingId, setTempTrackingId] = useState<string | null>(null)

  useEffect(() => {
    try {
      const hasUser = document.cookie.split(';').map(c=>c.trim()).some(c=>c.startsWith('current_user_id='))
      if (!hasUser) window.location.href = '/auth/login'
    } catch {}
  }, [])
  const loadOrgs = async () => {
    const res = await fetch('/api/orgs/my', { cache: 'no-store' })
    const data = await res.json()
    setOrgs((data.items || []).map((o: any) => ({ id: o.id, orgName: o.orgName })))
    if (!orgId && data.items?.length) {
      const cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
      const preferred = (data.items as any[]).find(o => o.id === cookieOrgId)?.id || data.items[0].id
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
    setSummary(data)
  }
  useEffect(() => { loadOrgs() }, [])
  useEffect(() => { setMounted(true); try { const r = document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || ''; setRole(r.toLowerCase()) } catch {} }, [])
  useEffect(() => { if (orgId) loadMembers(orgId) }, [orgId])
  useEffect(() => { if (orgId && memberId) loadSummary(memberId, orgId) }, [orgId, memberId])

  const fmt = (m: any) => {
    if (typeof m !== 'number') return m || '0:00'
    const h = Math.floor(m / 60)
    const min = m % 60
    return `${h}:${min < 10 ? '0' : ''}${min}`
  }

  const startSession = async () => {
    if (!orgId || !memberId) return
    const res = await fetch('/api/time/start', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, member_id: memberId, source: 'web' }) })
    // if (res.status === 403) {
    //   const d = await res.json()
    //   if (d.error === 'CHECKIN_COOLDOWN') {
    //     alert('You cannot check in again within 12 hours of your last session.')
    //     return
    //   }
    // }
    const _ = await res.json(); loadSummary(memberId, orgId)
    await beginTracking()
  }
  const stopSession = async () => {
    if (!orgId || !memberId) return
    const res = await fetch('/api/time/stop', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, member_id: memberId }) })
    const _ = await res.json(); loadSummary(memberId, orgId)
    await tracking.stopTracking()
  }
  const startBreak = async () => {
    if (!orgId || !memberId) return
    const res = await fetch('/api/time/break/start', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, member_id: memberId, label: 'Break' }) })
    const _ = await res.json(); loadSummary(memberId, orgId)
  }
  const stopBreak = async () => {
    if (!orgId || !memberId) return
    const res = await fetch('/api/time/break/stop', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, member_id: memberId }) })
    const _ = await res.json(); loadSummary(memberId, orgId)
  }
  const beginTracking = async () => {
    if (!orgId || !memberId) return
    const res = await fetch('/api/tracking/start', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, member_id: memberId }) })
    const data = await res.json()
    if (data.trackingAllowed && data.trackingSessionId) {
      if (data.consentRequired) {
        setTempTrackingId(data.trackingSessionId)
        setConsentText(String(data.consentText || ''))
        setConsentOpen(true)
      } else {
        // Automatically start if no consent required (unlikely but safe)
        const s = await fetch(`/api/activity/today?member_id=${memberId}&org_id=${orgId}`, { cache:'no-store' }).then(r=>r.json())
        await tracking.startTracking(data.trackingSessionId, s.settings)
      }
    }
  }
  const acceptConsent = async () => {
    if (!tempTrackingId) { setConsentOpen(false); return }
    const res = await fetch('/api/tracking/consent', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ tracking_session_id: tempTrackingId, accepted: true, consent_text: consentText }) })
    const data = await res.json()
    setConsentOpen(false)
    if (data.allowed) {
      const s = await fetch(`/api/activity/today?member_id=${memberId}&org_id=${orgId}`, { cache:'no-store' }).then(r=>r.json())
      await tracking.startTracking(tempTrackingId, s.settings)
    }
  }
  const rejectConsent = async () => {
    if (!tempTrackingId) { setConsentOpen(false); return }
    await fetch('/api/tracking/consent', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ tracking_session_id: tempTrackingId, accepted: false, consent_text: consentText }) })
    await tracking.stopTracking()
    setConsentOpen(false)
  }

  // No useEffect cleanup for tracking here - handled by Provider or explicit Stop
  
  return (
    <AppShell title="Dashboard">
      <div className="grid grid-3">
        <GlassCard title="Quick Actions">
          <div className="row" style={{gap:12, flexWrap:'wrap'}}>
            {mounted && role==='super_admin' && <GlassButton variant="primary" href="/org/create">Create Organization</GlassButton>}
            {mounted && role==='super_admin' && <GlassButton href="/org/list">View Organizations</GlassButton>}
          </div>
        </GlassCard>
        <GlassCard title="Today's Hours">
          <div className="grid grid-2" style={{marginBottom:12}}>
            <div>
              <div className="label">Organization</div>
              {(['employee','member'].includes(role)) ? (
                <span className="tag-pill">{orgs.find(o=>o.id===orgId)?.orgName || orgs.find(o=>o.id===orgId)?.orgName || orgs[0]?.orgName || ''}</span>
              ) : (
                <GlassSelect value={orgId} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setOrgId(e.target.value)}>
                  <option value="">Select org</option>
                  {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
                </GlassSelect>
              )}
            </div>
            <div>
              <div className="label">Member</div>
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
              <div className="title">{fmt(summary.today_hours)}</div>
            </div>
            <div>
              <div className="subtitle">Extra</div>
              <div className="title" style={{color:'var(--green)'}}>{fmt(summary.extra_time)}</div>
            </div>
            <div>
              <div className="subtitle">Short</div>
              <div className="title" style={{color:'var(--orange)'}}>{fmt(summary.short_time)}</div>
            </div>
          </div>
          {(['employee','member'].includes(role)) && (
            <div className="row" style={{gap:12}}>
              {!summary.session_open ? (
                <GlassButton variant="primary" onClick={startSession}>Check In</GlassButton>
              ) : (
                <GlassButton variant="secondary" onClick={stopSession}>Check Out</GlassButton>
              )}
              {!summary.break_open ? (
                <GlassButton onClick={startBreak}>Start Break</GlassButton>
              ) : (
                <GlassButton onClick={stopBreak}>End Break</GlassButton>
              )}
            </div>
          )}
        </GlassCard>
        <GlassCard title="Today Log">
          <div className="subtitle">Sessions and Breaks</div>
          <div>
            {(summary.sessions||[]).map((s: any) => (
              <div key={s.id} className="row" style={{gap:8,marginTop:6}}>
                <span className="badge">{s.status}</span>
                <span className="label">{new Date(s.startTime).toLocaleTimeString()} – {s.endTime ? new Date(s.endTime).toLocaleTimeString() : '...'}</span>
                <span className="label">{s.totalMinutes ? `${s.totalMinutes}m` : ''}</span>
              </div>
            ))}
            {(summary.breaks||[]).map((b: any) => (
              <div key={b.id} className="row" style={{gap:8,marginTop:6}}>
                <span className="badge">break</span>
                <span className="label">{b.label}</span>
                <span className="label">{new Date(b.startTime).toLocaleTimeString()} – {b.endTime ? new Date(b.endTime).toLocaleTimeString() : '...'}</span>
                <span className="label">{b.totalMinutes ? `${b.totalMinutes}m` : ''}</span>
              </div>
            ))}
          </div>
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
