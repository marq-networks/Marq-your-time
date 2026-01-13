"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassSelect from '@components/ui/GlassSelect'
import { normalizeRoleForApi } from '@lib/permissions'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string, departmentId?: string }
type Department = { id: string, name: string }

const PRIVILEGED_ROLES = ['admin','owner','super_admin','org_admin','hr','manager']

function formatHM(mins: number) { const m = Math.max(0, Math.round(mins||0)); const h=Math.floor(m/60); const mm=String(m%60).padStart(2,'0'); return `${h}:${mm}` }

export default function ActivityOverviewPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [members, setMembers] = useState<User[]>([])
  const [departmentId, setDepartmentId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [date, setDate] = useState(()=> new Date().toISOString().slice(0,10))
  const [items, setItems] = useState<any[]>([])
  const [totals, setTotals] = useState<any>({ tracked:0, productive:0, unproductive:0, idle:0, screenshots:0 })
  const [role, setRole] = useState('')
  const [actorId, setActorId] = useState('')

  const loadOrgs = async () => {
    const endpoint = role === 'super_admin' ? '/api/org/list' : '/api/orgs/my'
    const res = await fetch(endpoint, { cache:'no-store' })
    const d = await res.json()
    const items: Org[] = Array.isArray(d.items) ? (d.items as Org[]) : []
    setOrgs(items)
    if (!orgId && items.length) {
      const cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
      const preferred = items.find(o => o.id === cookieOrgId)?.id || items[0].id
      setOrgId(preferred)
    }
  }
  const loadDepsUsers = async (oid: string) => {
    const [dRes, uRes] = await Promise.all([ fetch(`/api/department/list?orgId=${oid}`, { cache:'no-store' }), fetch(`/api/user/list?orgId=${oid}`, { cache:'no-store' }) ])
    const [d,u] = await Promise.all([dRes.json(), uRes.json()])
    const deps: Department[] = Array.isArray(d.items) ? (d.items as Department[]) : []
    const users: User[] = Array.isArray(u.items) ? (u.items as User[]) : []
    setDepartments(deps)
    setMembers(users)
    if (!memberId && users.length) {
      const cookieUserId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_user_id='))?.split('=')[1] || '') : ''
      const preferredMember = users.find(m => m.id === cookieUserId)?.id || users[0].id
      setMemberId(preferredMember)
    }
    if (!departmentId) {
      const me = users.find(m => m.id === (actorId || memberId))
      if (me?.departmentId) setDepartmentId(me.departmentId)
    }
  }
  const loadOverview = async () => { 
    if(!orgId) return; 
    let useMemberId = memberId
    // Force memberId to actorId for non-privileged users
    if (role && !PRIVILEGED_ROLES.includes(role) && actorId) {
      useMemberId = actorId
    }
    const url = `/api/activity/overview?org_id=${orgId}&date=${date}` + (departmentId? `&department_id=${departmentId}`:'') + (useMemberId? `&member_id=${useMemberId}`:''); 
    const res = await fetch(url, { cache:'no-store' }); 
    const d = await res.json(); 
    setItems(d.items||[]); 
    setTotals(d.totals||{ tracked:0, productive:0, unproductive:0, idle:0, screenshots:0 }) 
  }

  useEffect(()=>{ try { const r = normalizeRoleForApi((typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : '')); setRole(r); const uid = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_user_id='))?.split('=')[1] || '') : ''; setActorId(uid) } catch {} }, [])
  
  useEffect(() => {
    if (role && !PRIVILEGED_ROLES.includes(role) && actorId) {
      setMemberId(actorId)
    }
  }, [role, actorId])

  useEffect(()=>{ loadOrgs() }, [role])
  useEffect(()=>{ if(orgId) { loadDepsUsers(orgId); } }, [orgId])
  useEffect(()=>{ loadOverview() }, [orgId, date, departmentId, memberId, role, actorId])

  const columns = ['Member','Department','Date','Worked','Tracked Active','Productive','Unproductive','Idle','Screenshots','Top Usage','Status']
  const rows = items.map(it => [
    it.memberName, 
    it.departmentName, 
    it.date, 
    formatHM(it.workedHours||0), 
    formatHM(it.trackedActiveMinutes||0), 
    formatHM(it.productiveMinutes||0), 
    formatHM(it.unproductiveMinutes||0), 
    formatHM(it.idleMinutes||0), 
    String(it.screenshots||0), 
    (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '220px', padding: '4px 0', fontSize: '12px' }}>
        {it.topApps?.length > 0 && (
          <div>
             <div style={{ fontWeight: 600, opacity: 0.7, fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>Apps</div>
             {it.topApps.slice(0,3).map((a:any) => (
               <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', whiteSpace: 'nowrap' }} title={`${a.name}: ${a.minutes}m (${a.category})`}>
                 <div style={{ flexShrink: 0, width: '6px', height: '6px', borderRadius: '999px', background: a.category === 'productive' ? '#34d399' : a.category === 'unproductive' ? '#fb7185' : '#9ca3af' }} />
                 <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    <span style={{ fontWeight: 500 }}>{a.name}</span> <span style={{ opacity: 0.6, fontSize: '10px' }}>({formatHM(a.minutes)})</span>
                 </div>
               </div>
             ))}
          </div>
        )}
        {it.topUrls?.length > 0 && (
          <div style={{ marginTop: it.topApps?.length > 0 ? '8px' : '0' }}>
            <div style={{ fontWeight: 600, opacity: 0.7, fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>Websites</div>
            {it.topUrls.slice(0,3).map((u:any) => (
              <div key={u.url} style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', whiteSpace: 'nowrap' }} title={`${u.url}: ${u.minutes}m (${u.category})`}>
                <div style={{ flexShrink: 0, width: '6px', height: '6px', borderRadius: '999px', background: u.category === 'productive' ? '#34d399' : u.category === 'unproductive' ? '#fb7185' : '#9ca3af' }} />
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    <span>{u.url}</span> <span style={{ opacity: 0.6, fontSize: '10px' }}>({formatHM(u.minutes)})</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {(!it.topApps?.length && !it.topUrls?.length) && <span style={{ opacity: 0.3 }}>-</span>}
      </div>
    ),
    it.status 
  ])

  return (
    <AppShell title="Activity Overview">
      {(PRIVILEGED_ROLES.includes(role)) ? (
        <GlassCard title="Filters">
          <div className="grid grid-1">
            <div>
              <div className="label">Organization</div>
              {role === 'super_admin' ? (
                <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
                  <option value="">Select org</option>
                  {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
                </GlassSelect>
              ) : (
                <span className="tag-pill">{orgs.find(o => o.id === orgId)?.orgName || orgs[0]?.orgName || ''}</span>
              )}
            </div>
            <div>
              <div className="label">Date</div>
              <input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)} />
            </div>
            <div>
              <div className="label">Department</div>
              <GlassSelect value={departmentId} onChange={(e:any)=>setDepartmentId(e.target.value)}>
                <option value="">All</option>
                {departments.map(d=> <option key={d.id} value={d.id}>{d.name}</option>)}
              </GlassSelect>
            </div>
            <div>
              <div className="label">Member</div>
              <GlassSelect value={memberId} onChange={(e:any)=>setMemberId(e.target.value)}>
                <option value="">All</option>
                {members.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
              </GlassSelect>
            </div>
          </div>
        </GlassCard>
      ) : (
        <GlassCard title="Context">
          <div className="grid grid-2">
            <div>
              <div className="label">Organization</div>
              <span className="tag-pill">{orgs.find(o => o.id === orgId)?.orgName || orgs[0]?.orgName || ''}</span>
            </div>
            <div>
              <div className="label">Department</div>
              <span className="tag-pill">{departments.find(d => d.id === departmentId)?.name || '-'}</span>
            </div>
          </div>
        </GlassCard>
      )}

      <div className="grid grid-1 mt-4">
        <GlassCard title="Total Tracked">
          <div className="title">{formatHM(totals.tracked||0)}</div>
          <div className="subtitle">Active minutes</div>
        </GlassCard>
        <GlassCard title="Productive vs Unproductive">
          <div className="row" style={{gap:12}}>
            <div className="title" style={{color:'var(--green)'}}>{formatHM(totals.productive||0)}</div>
            <div className="title" style={{color:'var(--orange)'}}>{formatHM(totals.unproductive||0)}</div>
          </div>
        </GlassCard>
        <GlassCard title="Screenshots">
          <div className="title">{String(totals.screenshots||0)}</div>
        </GlassCard>
      </div>

      <GlassCard title="Per-member Activity">
        <GlassTable columns={columns} rows={rows} />
      </GlassCard>
    </AppShell>
  )
}
