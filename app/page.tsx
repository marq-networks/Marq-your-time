"use client"
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import usePermission from '@lib/hooks/usePermission'
import { useEffect, useMemo, useState } from 'react'

export default function Page() {
  const canOrg = usePermission('manage_org').allowed
  const [orgs, setOrgs] = useState<{ id: string, orgName: string }[]>([])
  const [orgId, setOrgId] = useState('')
  const [members, setMembers] = useState<{ id: string, firstName: string, lastName: string }[]>([])
  const [memberId, setMemberId] = useState('')
  const [summary, setSummary] = useState<any>({ today_hours:'0:00', extra_time:'+00:00', short_time:'-00:00', session:null, break:null, sessions:[], breaks:[] })

  const loadOrgs = async () => {
    const res = await fetch('/api/org/list', { cache: 'no-store' })
    const data = await res.json()
    setOrgs(data.items || [])
    if (!orgId && data.items?.length) setOrgId(data.items[0].id)
  }
  const loadMembers = async (oid: string) => {
    if (!oid) return
    const res = await fetch(`/api/user/list?orgId=${oid}`, { cache: 'no-store' })
    const data = await res.json()
    setMembers(data.items || [])
    if (!memberId && data.items?.length) setMemberId(data.items[0].id)
  }
  const loadSummary = async (mid: string, oid: string) => {
    if (!mid || !oid) return
    const res = await fetch(`/api/time/today?member_id=${mid}&org_id=${oid}`, { cache: 'no-store' })
    const data = await res.json()
    setSummary(data)
  }
  useEffect(() => { loadOrgs() }, [])
  useEffect(() => { if (orgId) loadMembers(orgId) }, [orgId])
  useEffect(() => { if (orgId && memberId) loadSummary(memberId, orgId) }, [orgId, memberId])

  const startSession = async () => {
    if (!orgId || !memberId) return
    const res = await fetch('/api/time/start', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, member_id: memberId, source: 'web' }) })
    const _ = await res.json(); loadSummary(memberId, orgId)
  }
  const stopSession = async () => {
    if (!orgId || !memberId) return
    const res = await fetch('/api/time/stop', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, member_id: memberId }) })
    const _ = await res.json(); loadSummary(memberId, orgId)
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
  const status = useMemo(()=>{
    if (summary.break) return { label: 'On Break', color: '#ff3b3b' }
    if (summary.session) return { label: 'Working', color: 'var(--green)' }
    return { label: 'Checked Out', color: '#ff3b3b' }
  }, [summary])
  return (
    <AppShell title="Dashboard">
      <div className="grid grid-3">
        <GlassCard title="Quick Actions">
          <div className="row" style={{gap:12, flexWrap:'wrap'}}>
            {canOrg && <GlassButton variant="primary" href="/org/create">Create Organization</GlassButton>}
            <GlassButton href="/org/list">View Organizations</GlassButton>
          </div>
        </GlassCard>
        <GlassCard title="Today's Hours">
          <div className="grid grid-2" style={{marginBottom:12}}>
            <div>
              <div className="label">Organization</div>
              <GlassSelect value={orgId} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setOrgId(e.target.value)}>
                <option value="">Select org</option>
                {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
              </GlassSelect>
            </div>
            <div>
              <div className="label">Member</div>
              <GlassSelect value={memberId} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setMemberId(e.target.value)}>
                <option value="">Select member</option>
                {members.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
              </GlassSelect>
            </div>
          </div>
          <div className="row" style={{alignItems:'center',gap:16,marginBottom:12}}>
            <div style={{width:64,height:64,borderRadius:'50%',background:status.color,border:'2px solid var(--border)',boxShadow:'0 0 12px rgba(0,0,0,0.25)'}}></div>
            <div>
              <div className="title" style={{margin:0}}>{status.label}</div>
              <div className="subtitle" style={{marginTop:4}}>{summary.session ? 'Session active' : 'No active session'}{summary.break ? ' • Break active' : ''}</div>
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
    </AppShell>
  )
}
