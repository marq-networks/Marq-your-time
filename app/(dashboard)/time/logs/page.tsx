"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassInput from '@components/ui/GlassInput'
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

export default function TimeLogsPage() {
  const [role, setRole] = useState('')
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [members, setMembers] = useState<User[]>([])
  const [memberId, setMemberId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { 
    try { 
      const r = normalizeRoleForApi((typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''))
      setRole(r) 
    } catch {} 
  }, [])

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
  }

  const loadLogs = async () => {
    if (!orgId || !date) return
    setLoading(true)
    let url = `/api/time/logs?org_id=${orgId}&date=${date}`
    if (memberId) url += `&member_id=${memberId}`
    
    try {
      const res = await fetch(url, { cache: 'no-store' })
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOrgs() }, [role])
  useEffect(() => { if (orgId) { loadMembers(orgId); } }, [orgId])
  useEffect(() => { if (orgId && date) loadLogs() }, [orgId, date, memberId])

  return (
    <AppShell title="Time Logs">
      <div className="grid grid-3" style={{marginBottom: 24, gap: 16}}>
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
          <div className="label">Date</div>
          <GlassInput type="date" value={date} onChange={(e: any) => setDate(e.target.value)} />
        </div>
        <div>
          <div className="label">Member</div>
          {(['employee','member'].includes(role)) ? (
             <span className="tag-pill">Me</span>
          ) : (
            <GlassSelect value={memberId} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setMemberId(e.target.value)}>
              <option value="">All Members</option>
              {members.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
            </GlassSelect>
          )}
        </div>
      </div>

      <GlassCard title="Time Sessions">
        {loading ? (
          <div style={{padding:20, textAlign:'center', opacity:0.6}}>Loading...</div>
        ) : (
          <table className="glass-table">
            <thead>
              <tr>
                {(!['employee','member'].includes(role) && !memberId) && <th>Member</th>}
                <th>Client / Project / Task</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr><td colSpan={6} style={{textAlign:'center', padding:20, opacity:0.6}}>No sessions found for this date</td></tr>
              ) : (
                sessions.map(s => {
                  const mem = members.find(m => m.id === s.memberId)
                  return (
                    <tr key={s.id}>
                      {(!['employee','member'].includes(role) && !memberId) && (
                        <td>{mem ? `${mem.firstName} ${mem.lastName}` : 'Unknown'}</td>
                      )}
                      <td>
                        {s.projectName ? (
                          <div>
                            {s.clientName && <div style={{fontSize:'0.75em', opacity:0.6, textTransform:'uppercase', letterSpacing:'0.05em'}}>{s.clientName}</div>}
                            <div style={{fontWeight:600}}>{s.projectName}</div>
                            {s.taskTitle && <div style={{fontSize:'0.8em', opacity:0.7}}>{s.taskTitle}</div>}
                          </div>
                        ) : <span style={{opacity:0.5}}>-</span>}
                      </td>
                      <td>{new Date(s.startTime).toLocaleTimeString()}</td>
                      <td>{s.endTime ? new Date(s.endTime).toLocaleTimeString() : '...'}</td>
                      <td>{formatHM(s.totalMinutes || 0)}</td>
                      <td>
                        <span className={`status-pill ${s.status === 'open' ? 'active' : s.status === 'closed' ? 'success' : 'error'}`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}
      </GlassCard>
    </AppShell>
  )
}
