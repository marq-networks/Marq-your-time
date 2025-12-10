'use client'
import { useEffect, useMemo, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassSelect from '@components/ui/GlassSelect'
import GlassTable from '@components/ui/GlassTable'

type Org = { id: string, orgName: string }
type Dept = { id: string, name: string }
type Member = { id: string, firstName: string, lastName: string, departmentId?: string }
type TimeRow = { memberId: string, memberName: string, departmentName?: string, status: string, workedMinutes: number }

export default function TeamDashboardPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [departments, setDepartments] = useState<Dept[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [departmentId, setDepartmentId] = useState('')
  const [rows, setRows] = useState<TimeRow[]>([])
  const [leaveIds, setLeaveIds] = useState<string[]>([])

  const today = new Date().toISOString().slice(0,10)

  const loadOrgs = async () => { const r = await fetch('/api/org/list', { cache:'no-store' }); const d = await r.json(); setOrgs(d.items||[]); if (!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadDeps = async (oid: string) => { const r = await fetch(`/api/department/list?orgId=${oid}`, { cache:'no-store' }); const d = await r.json(); setDepartments(d.items||[]) }
  const loadMembers = async (oid: string) => { const r = await fetch(`/api/user/list?orgId=${oid}`, { cache:'no-store' }); const d = await r.json(); setMembers(d.items||[]) }
  const loadTime = async () => {
    if (!orgId) return
    const q = new URLSearchParams(); q.set('org_id', orgId); q.set('date', today)
    const r = await fetch(`/api/time/logs?${q.toString()}`, { cache:'no-store' })
    const d = await r.json()
    const items: TimeRow[] = (d.items||[]).map((it: any) => ({ memberId: it.memberId || it.member_id, memberName: it.memberName || it.member_name, departmentName: it.departmentName || it.department_name, status: it.status, workedMinutes: Number(it.workedMinutes || it.worked_minutes || 0) }))
    setRows(items)
  }
  const loadLeave = async () => {
    if (!orgId) { setLeaveIds([]); return }
    const p = new URLSearchParams(); p.set('org_id', orgId); p.set('status', 'approved'); p.set('start_date', today); p.set('end_date', today)
    const r = await fetch(`/api/leave/requests?${p.toString()}`, { cache:'no-store' })
    const d = await r.json()
    const ids: string[] = (d.items||[]).map((it: any) => String(it.member_id || it.memberId))
    setLeaveIds(ids)
  }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if (orgId) { loadDeps(orgId); loadMembers(orgId); loadTime(); loadLeave() } }, [orgId])

  const filtered = useMemo(()=> rows.filter(r => !departmentId || (departments.find(d=>d.id===departmentId)?.name===r.departmentName)), [rows, departmentId, departments])
  const present = filtered.filter(r => r.workedMinutes > 0).length
  const absent = filtered.filter(r => r.status === 'absent').length
  const onLeave = filtered.filter(r => leaveIds.includes(r.memberId)).length
  const lateOrShort = filtered.filter(r => r.status === 'short').length

  const columns = ['Member','Department','Status','Worked']
  const trows = filtered.map(r => [ r.memberName, r.departmentName||'', r.status, `${r.workedMinutes}m` ])

  return (
    <AppShell title="Team Dashboard">
      <GlassCard title="Filters">
        <div className="grid grid-3">
          <div>
            <div className="label">Organization</div>
            <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">Department</div>
            <GlassSelect value={departmentId} onChange={(e:any)=>setDepartmentId(e.target.value)}>
              <option value="">All</option>
              {departments.map(d=> <option key={d.id} value={d.id}>{d.name}</option>)}
            </GlassSelect>
          </div>
          <div className="row" style={{alignItems:'end',gap:8}}>
            <span className="badge">{today}</span>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-4" style={{marginTop:12}}>
        <GlassCard title="Present"><div className="title">{present}</div></GlassCard>
        <GlassCard title="Leave"><div className="title">{onLeave}</div></GlassCard>
        <GlassCard title="Absent"><div className="title">{absent}</div></GlassCard>
        <GlassCard title="Late/Short"><div className="title">{lateOrShort}</div></GlassCard>
      </div>

      <GlassCard title="Members">
        <GlassTable columns={columns} rows={trows} />
      </GlassCard>
    </AppShell>
  )
}
