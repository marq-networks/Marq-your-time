"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import { normalizeRoleForApi } from '@lib/permissions'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string }

function formatHM(mins: number) {
  const m = Math.max(0, Math.round(mins || 0))
  const h = Math.floor(m / 60)
  const mm = String(m % 60).padStart(2,'0')
  return `${h}:${mm}`
}

export default function MyDayPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [members, setMembers] = useState<User[]>([])
  const [memberId, setMemberId] = useState('')
  const [summary, setSummary] = useState<any>({ today_hours: '00:00', extra_time: '+00:00', short_time: '-00:00', session_open: false, break_open: false, sessions: [], breaks: [] })
  const [role, setRole] = useState('')

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
    setSummary(data)
  }

  useEffect(() => { try { const r = normalizeRoleForApi((typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : '')); setRole(r) } catch {} }, [])
  useEffect(() => { loadOrgs() }, [role])
  useEffect(() => { if (orgId) loadMembers(orgId) }, [orgId])
  useEffect(() => { if (orgId && memberId) loadSummary(memberId, orgId) }, [orgId, memberId])

  const startDay = async () => {
    if (!orgId || !memberId) return
    await fetch('/api/time/start', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, member_id: memberId, source: 'web' }) })
    loadSummary(memberId, orgId)
  }
  const endDay = async () => {
    if (!orgId || !memberId) return
    await fetch('/api/time/stop', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, member_id: memberId }) })
    loadSummary(memberId, orgId)
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
              <div className="subtitle">Extra</div>
              <div className="title" style={{color:'var(--green)'}}>{summary.extra_time}</div>
            </div>
            <div>
              <div className="subtitle">Short</div>
              <div className="title" style={{color:'var(--orange)'}}>{summary.short_time}</div>
            </div>
          </div>
          <div className="row" style={{gap:12}}>
            {!summary.session_open ? (
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
    </AppShell>
  )
}
