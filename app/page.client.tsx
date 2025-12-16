"use client"
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import GlassModal from '@components/ui/GlassModal'
import usePermission from '@lib/hooks/usePermission'
import { useEffect, useRef, useState } from 'react'

export default function DashboardClient() {
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
  const [trackingSessionId, setTrackingSessionId] = useState<string | null>(null)
  const [activityTimer, setActivityTimer] = useState<any>(null)
  const [screenshotTimer, setScreenshotTimer] = useState<any>(null)
  const mouseCountRef = useRef(0)
  const keyCountRef = useRef(0)
  const streamRef = useRef<MediaStream | null>(null)

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

  const startSession = async () => {
    if (!orgId || !memberId) return
    const res = await fetch('/api/time/start', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, member_id: memberId, source: 'web' }) })
    const _ = await res.json(); loadSummary(memberId, orgId)
    await beginTracking()
  }
  const stopSession = async () => {
    if (!orgId || !memberId) return
    const res = await fetch('/api/time/stop', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, member_id: memberId }) })
    const _ = await res.json(); loadSummary(memberId, orgId)
    await stopTrackingFlow()
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
      setTrackingSessionId(data.trackingSessionId)
      if (data.consentRequired) {
        setConsentText(String(data.consentText || ''))
        setConsentOpen(true)
      }
    }
  }
  const acceptConsent = async () => {
    if (!trackingSessionId) { setConsentOpen(false); return }
    const res = await fetch('/api/tracking/consent', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ tracking_session_id: trackingSessionId, accepted: true, consent_text: consentText }) })
    const data = await res.json()
    setConsentOpen(false)
    if (data.allowed) {
      startActivityLoop()
      const s = await fetch(`/api/activity/today?member_id=${memberId}&org_id=${orgId}`, { cache:'no-store' }).then(r=>r.json())
      if (s.settings?.allowScreenshots) {
        await captureAndSendScreenshot()
        const t = setInterval(captureAndSendScreenshot, 5 * 60 * 1000)
        setScreenshotTimer(t)
      }
    }
  }
  const rejectConsent = async () => {
    if (!trackingSessionId) { setConsentOpen(false); return }
    await fetch('/api/tracking/consent', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ tracking_session_id: trackingSessionId, accepted: false, consent_text: consentText }) })
    setConsentOpen(false)
  }
  const startActivityLoop = () => {
    if (activityTimer) return
    const onMouse = () => { mouseCountRef.current += 1 }
    const onKey = () => { keyCountRef.current += 1 }
    window.addEventListener('mousemove', onMouse)
    window.addEventListener('keydown', onKey)
    const t = setInterval(async () => {
      if (!trackingSessionId) return
      const ev = {
        timestamp: Date.now(),
        app_name: 'Web',
        window_title: document.title || 'MARQ',
        url: location.href,
        is_active: document.hasFocus(),
        keyboard_activity_score: keyCountRef.current,
        mouse_activity_score: mouseCountRef.current
      }
      keyCountRef.current = 0
      mouseCountRef.current = 0
      await fetch('/api/activity/batch', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ tracking_session_id: trackingSessionId, events: [ev] }) })
    }, 60 * 1000)
    setActivityTimer(t)
  }
  const stopTrackingFlow = async () => {
    if (activityTimer) { clearInterval(activityTimer); setActivityTimer(null) }
    if (screenshotTimer) { clearInterval(screenshotTimer); setScreenshotTimer(null) }
    if (streamRef.current) { streamRef.current.getTracks().forEach(tr=>tr.stop()); streamRef.current = null }
    if (trackingSessionId) {
      await fetch('/api/tracking/stop', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ tracking_session_id: trackingSessionId }) })
    }
    setTrackingSessionId(null)
  }
  const ensureStream = async () => {
    if (streamRef.current) return streamRef.current
    try {
      const ms = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      streamRef.current = ms
      return ms
    } catch {
      return null
    }
  }
  const captureAndSendScreenshot = async () => {
    if (!trackingSessionId) return
    const ms = await ensureStream()
    if (!ms) return
    const video = document.createElement('video')
    video.srcObject = ms
    await new Promise(r => { video.onloadedmetadata = () => r(null); video.play().then(()=>r(null)).catch(()=>r(null)) })
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/png', 0.8)
    await fetch('/api/activity/screenshot', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ tracking_session_id: trackingSessionId, timestamp: Date.now(), image: dataUrl }) })
  }
  useEffect(() => { return () => { stopTrackingFlow() } }, [])
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
              <div className="title">{summary.today_hours}</div>
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
            {!summary.session ? (
              <GlassButton variant="primary" onClick={startSession}>Check In</GlassButton>
            ) : (
              <GlassButton variant="secondary" onClick={stopSession}>Check Out</GlassButton>
            )}
            {!summary.break ? (
              <GlassButton onClick={startBreak}>Start Break</GlassButton>
            ) : (
              <GlassButton onClick={stopBreak}>End Break</GlassButton>
            )}
          </div>
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
