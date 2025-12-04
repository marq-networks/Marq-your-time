'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import GlassModal from '@components/ui/GlassModal'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string }

export default function TimesheetsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [orgId, setOrgId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [range, setRange] = useState<'week'|'month'>('week')
  const [days, setDays] = useState<string[]>([])
  const [rows, setRows] = useState<React.ReactNode[][]>([])
  const [leave, setLeave] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>({ date:'', reason:'', new_start:'', new_end:'', new_minutes:'' })

  const loadOrgs = async () => {
    const r = await fetch('/api/org/list', { cache:'no-store', headers:{ 'x-user-id': 'admin' } })
    const d = await r.json()
    setOrgs(d.items || [])
  }

  const loadUsers = async (org: string) => {
    const r = await fetch(`/api/user/list?orgId=${org}`, { cache:'no-store' })
    const d = await r.json()
    setUsers(d.items || [])
  }

  const computeDays = (mode: 'week'|'month') => {
    const today = new Date()
    let arr: string[] = []
    if (mode === 'week') {
      const start = new Date(today)
      const diff = start.getDay()
      start.setDate(start.getDate() - diff)
      for (let i = 0; i < 7; i++) arr.push(new Date(start.getTime() + i*24*60*60*1000).toISOString().slice(0,10))
    } else {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      const end = new Date(today.getFullYear(), today.getMonth()+1, 0)
      for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 24*60*60*1000)) arr.push(d.toISOString().slice(0,10))
    }
    setDays(arr)
  }

  const loadLeave = async () => {
    if (!orgId || !memberId || days.length === 0) { setLeave([]); return }
    const start = days[0]
    const end = days[days.length-1]
    const r = await fetch(`/api/leave/requests?org_id=${orgId}&member_id=${memberId}&status=approved&start_date=${start}&end_date=${end}`, { cache:'no-store' })
    const d = await r.json()
    setLeave(d.items||[])
  }

  const loadRows = async () => {
    if (!orgId || !memberId || days.length === 0) { setRows([]); return }
    const out: React.ReactNode[][] = []
    for (const day of days) {
      const r = await fetch(`/api/time/logs?org_id=${orgId}&date=${day}&member_id=${memberId}`, { cache:'no-store' })
      const d = await r.json()
      const s = (d.items || []).find((x:any) => x.memberId === memberId)
      const worked = s ? s.workedMinutes : 0
      const extra = s ? s.extraMinutes : 0
      const short = s ? s.shortMinutes : 0
      const isLeave = leave.some((lr:any)=> day >= lr.start_date && day <= lr.end_date)
      out.push([ day, isLeave? <span className="badge">Leave</span> : `${Math.floor(worked/60)}:${String(worked%60).padStart(2,'0')}`, `+${Math.floor(extra/60)}:${String(extra%60).padStart(2,'0')}`, `-${Math.floor(short/60)}:${String(short%60).padStart(2,'0')}`, <GlassButton onClick={()=>{ setForm({ date:day, reason:'', new_start:'', new_end:'', new_minutes:'' }); setOpen(true) }}>Request change</GlassButton> ])
    }
    setRows(out)
  }

  const submit = async () => {
    const items = [ { target_date: form.date, new_start: form.new_start ? new Date(form.new_start).toISOString() : undefined, new_end: form.new_end ? new Date(form.new_end).toISOString() : undefined, new_minutes: form.new_minutes ? Number(form.new_minutes) : undefined, note: form.reason } ]
    const res = await fetch('/api/timesheets/change/request', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-user-id': memberId }, body: JSON.stringify({ org_id: orgId, member_id: memberId, reason: form.reason, items }) })
    setOpen(false)
    await loadRows()
  }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if (orgId) loadUsers(orgId); setMemberId('') }, [orgId])
  useEffect(()=>{ computeDays(range) }, [range])
  useEffect(()=>{ loadLeave() }, [orgId, memberId, days.length])
  useEffect(()=>{ loadRows() }, [orgId, memberId, days.length, leave.length])

  const columns = ['Date','Worked/Status','Extra','Short','Actions']

  return (
    <AppShell title="Timesheets">
      <GlassCard title="Filters">
        <div className="grid-3">
          <div>
            <div className="label">Organization</div>
            <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">Member</div>
            <GlassSelect value={memberId} onChange={(e:any)=>setMemberId(e.target.value)}>
              <option value="">Select member</option>
              {users.map(u=> <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">Range</div>
            <GlassSelect value={range} onChange={(e:any)=>setRange(e.target.value)}>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </GlassSelect>
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Timesheet">
        <GlassTable columns={columns} rows={rows} />
      </GlassCard>

      <GlassModal open={open} title="Request Change" onClose={()=>setOpen(false)}>
        <div className="grid-2">
          <div>
            <div className="label">Date</div>
            <input className="input" type="date" value={form.date} onChange={(e)=>setForm({...form, date:e.target.value})} />
          </div>
          <div>
            <div className="label">Reason</div>
            <input className="input" type="text" value={form.reason} onChange={(e)=>setForm({...form, reason:e.target.value})} />
          </div>
        </div>
        <div className="grid-3" style={{ marginTop:12 }}>
          <div>
            <div className="label">New Start</div>
            <input className="input" type="datetime-local" value={form.new_start} onChange={(e)=>setForm({...form, new_start:e.target.value})} />
          </div>
          <div>
            <div className="label">New End</div>
            <input className="input" type="datetime-local" value={form.new_end} onChange={(e)=>setForm({...form, new_end:e.target.value})} />
          </div>
          <div>
            <div className="label">New Minutes</div>
            <input className="input" type="number" value={form.new_minutes} onChange={(e)=>setForm({...form, new_minutes:e.target.value})} />
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:12 }}>
          <GlassButton onClick={submit}>Submit</GlassButton>
        </div>
      </GlassModal>
    </AppShell>
  )
}
