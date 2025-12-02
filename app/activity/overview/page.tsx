"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassSelect from '@components/ui/GlassSelect'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string, departmentId?: string }
type Department = { id: string, name: string }

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

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store' }); const d = await res.json(); setOrgs(d.items||[]); if(!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadDepsUsers = async (oid: string) => { const [dRes, uRes] = await Promise.all([ fetch(`/api/department/list?orgId=${oid}`, { cache:'no-store' }), fetch(`/api/user/list?orgId=${oid}`, { cache:'no-store' }) ]); const [d,u] = await Promise.all([dRes.json(), uRes.json()]); setDepartments(d.items||[]); setMembers(u.items||[]) }
  const loadOverview = async () => { if(!orgId) return; const url = `/api/activity/overview?org_id=${orgId}&date=${date}` + (departmentId? `&department_id=${departmentId}`:'') + (memberId? `&member_id=${memberId}`:''); const res = await fetch(url, { cache:'no-store' }); const d = await res.json(); setItems(d.items||[]); setTotals(d.totals||{ tracked:0, productive:0, unproductive:0, idle:0, screenshots:0 }) }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId) { loadDepsUsers(orgId); } }, [orgId])
  useEffect(()=>{ loadOverview() }, [orgId, date, departmentId, memberId])

  const columns = ['Member','Department','Date','Worked','Tracked Active','Productive','Unproductive','Idle','Screenshots','Status']
  const rows = items.map(it => [ it.memberName, it.departmentName, it.date, formatHM(it.workedHours||0), formatHM(it.trackedActiveMinutes||0), formatHM(it.productiveMinutes||0), formatHM(it.unproductiveMinutes||0), formatHM(it.idleMinutes||0), String(it.screenshots||0), it.status ])

  return (
    <AppShell title="Activity Overview">
      <GlassCard title="Filters">
        <div className="grid grid-1">
          <div>
            <div className="label">Organization</div>
            <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
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

      <GlassCard title="Per-member Activity mt-5">
        <GlassTable columns={columns} rows={rows} />
      </GlassCard>
    </AppShell>
  )
}
