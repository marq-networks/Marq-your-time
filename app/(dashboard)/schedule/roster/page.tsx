'use client'
import { useEffect, useMemo, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassTable from '@components/ui/GlassTable'

type Org = { id: string, orgName: string }
type Department = { id: string, name: string }
type User = { id: string, firstName: string, lastName: string, departmentId?: string }
type Shift = { id: string, name: string }
type Assignment = { id: string, memberId: string, shiftId: string, effectiveFrom: string, effectiveTo?: string }

function weekDays(baseDate: string) {
  const dt = new Date(baseDate + 'T00:00:00')
  const day = dt.getDay()
  const mondayOffset = ((day + 6) % 7)
  const monday = new Date(dt.getTime() - mondayOffset*24*60*60*1000)
  const arr: string[] = []
  for (let i=0;i<7;i++) arr.push(new Date(monday.getTime() + i*24*60*60*1000).toISOString().slice(0,10))
  return arr
}

export default function RosterPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [members, setMembers] = useState<User[]>([])
  const [departmentId, setDepartmentId] = useState('')
  const [date, setDate] = useState(()=> new Date().toISOString().slice(0,10))
  const [shifts, setShifts] = useState<Shift[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selecting, setSelecting] = useState<{memberId?:string, day?:string}>({})
  const [selShift, setSelShift] = useState('')

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store' }); const d = await res.json(); setOrgs(d.items||[]); if(!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadDepsUsers = async (oid: string) => { const [deps, users] = await Promise.all([ fetch(`/api/department/list?org_id=${oid}`).then(r=>r.json()), fetch(`/api/user/list?org_id=${oid}`).then(r=>r.json()) ]); setDepartments(deps.items||[]); setMembers(users.items||[]) }
  const loadShifts = async (oid: string) => { const res = await fetch(`/api/shifts?org_id=${oid}`, { cache:'no-store' }); const d = await res.json(); setShifts(d.items||[]) }
  const loadAssignments = async (oid: string) => { const res = await fetch(`/api/shifts/assign?org_id=${oid}`, { cache:'no-store', headers:{'x-role':'admin'} }); const d = await res.json(); setAssignments(d.items||[]) }
  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId) { loadDepsUsers(orgId); loadShifts(orgId); loadAssignments(orgId) } }, [orgId])

  const days = useMemo(()=> weekDays(date), [date])
  const memberRows = useMemo(()=> members.filter(m=> !departmentId || m.departmentId===departmentId), [members, departmentId])
  const asgMap = useMemo(()=> {
    const map = new Map<string,string>()
    for (const a of assignments) for (const day of days) if (day >= a.effectiveFrom && (!a.effectiveTo || day <= a.effectiveTo)) map.set(`${a.memberId}|${day}`, a.shiftId)
    return map
  }, [assignments, days])

  const assignOne = async () => {
    if (!selecting.memberId || !selecting.day || !selShift) return
    const res = await fetch('/api/shifts/assign', { method:'POST', headers:{ 'Content-Type':'application/json','x-role':'admin','x-org-id': orgId }, body: JSON.stringify({ member_id: selecting.memberId, shift_id: selShift, effective_from: selecting.day, effective_to: selecting.day }) })
    if (res.ok) { setSelecting({}); setSelShift(''); loadAssignments(orgId) }
  }

  return (
    <AppShell title="Roster & Scheduling">
      <GlassCard title="Filters">
        <div className="grid grid-4">
          <div>
            <div className="label">Organization</div>
            <select className="input" value={orgId} onChange={(e:any)=> setOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </select>
          </div>
          <div>
            <div className="label">Department</div>
            <select className="input" value={departmentId} onChange={(e:any)=> setDepartmentId(e.target.value)}>
              <option value="">All</option>
              {departments.map(d=> <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <div className="label">Week of</div>
            <input className="input" type="date" value={date} onChange={e=> setDate(e.target.value)} />
          </div>
          <div className="row" style={{alignItems:'end',gap:8}}>
            <GlassButton variant="secondary" onClick={()=> loadAssignments(orgId)}>Refresh</GlassButton>
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Weekly Roster">
        <GlassTable columns={[ 'Member', ...days ]} rows={memberRows.map(m => [ `${m.firstName} ${m.lastName}`, ...days.map(d => (
          <div key={`${m.id}|${d}`} className="rounded" style={{ padding:'6px', cursor:'pointer'}} onClick={()=> { setSelecting({ memberId: m.id, day: d }) }}>
            {(() => { const sId = asgMap.get(`${m.id}|${d}`); const s = shifts.find(x=> x.id===sId); return s ? s.name : '-' })()}
          </div>
        )) ])} />
      </GlassCard>

      {selecting.memberId && (
        <div className="modal-backdrop">
          <div className="modal glass-panel" style={{ borderRadius:'var(--radius-large)', padding:16, width:380 }}>
            <div className="card-title">Assign Shift</div>
            <div className="label" style={{marginTop:8}}>Shift</div>
            <select className="input" value={selShift} onChange={(e:any)=> setSelShift(e.target.value)}>
              <option value="">Select shift</option>
              {shifts.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="row" style={{gap:8,marginTop:12}}>
              <GlassButton variant="primary" onClick={assignOne}>Assign</GlassButton>
              <GlassButton variant="secondary" onClick={()=> { setSelecting({}); setSelShift('') }}>Cancel</GlassButton>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}

