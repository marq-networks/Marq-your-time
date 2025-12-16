'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassModal from '@components/ui/GlassModal'
import GlassSelect from '@components/ui/GlassSelect'
import { normalizeRoleForApi } from '@lib/permissions'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string }

function monthDays(date: Date) { const start = new Date(date.getFullYear(), date.getMonth(), 1); const end = new Date(date.getFullYear(), date.getMonth()+1, 0); const arr: string[] = []; for (let d = new Date(start); d <= end; d = new Date(d.getTime()+24*60*60*1000)) arr.push(d.toISOString().slice(0,10)); return arr }
function inRange(d: string, s: string, e: string) { return d >= s && d <= e }

export default function LeavePage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [members, setMembers] = useState<User[]>([])
  const [orgId, setOrgId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [types, setTypes] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [date, setDate] = useState(new Date())
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>({ type:'', start:'', end:'', reason:'' })
  const [role, setRole] = useState<string>('')

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
  const loadMembers = async (oid: string) => {
    const res = await fetch(`/api/user/list?orgId=${oid}`, { cache:'no-store' })
    const d = await res.json()
    const items: User[] = Array.isArray(d.items) ? (d.items as User[]) : []
    setMembers(items)
    if (!memberId && items.length) {
      const cookieUserId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_user_id='))?.split('=')[1] || '') : ''
      const preferredMember = items.find(m => m.id === cookieUserId)?.id || items[0].id
      setMemberId(preferredMember)
    }
  }
  const loadTypes = async (oid: string) => { const res = await fetch(`/api/leave/types?org_id=${oid}`, { cache:'no-store' }); const d = await res.json(); const items = d.items||[]; setTypes(items); if (!form.type && items.length) setForm((f:any)=> ({ ...f, type: items[0].id })) }
  const loadMy = async (mid: string) => { const res = await fetch(`/api/leave/my-requests?member_id=${mid}`, { cache:'no-store' }); const d = await res.json(); setRequests(d.items||[]) }
  const submit = async () => {
    if(!orgId || !memberId || !form.type || !form.start || !form.end) return;
    const res = await fetch('/api/leave/request', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-user-id': memberId }, body: JSON.stringify({ org_id: orgId, member_id: memberId, leave_type_id: form.type, start_date: form.start, end_date: form.end, reason: form.reason }) });
    if (res.ok) {
      setOpen(false);
      setForm({ type: form.type, start:'', end:'', reason:'' })
      await loadMy(memberId)
    }
  }

  useEffect(()=>{ try { const r = normalizeRoleForApi((typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : '')); setRole(r) } catch {} }, [])
  useEffect(()=>{ loadOrgs() }, [role])
  useEffect(()=>{ if(orgId) { loadMembers(orgId); loadTypes(orgId) } }, [orgId])
  useEffect(()=>{ if(memberId) loadMy(memberId) }, [memberId])

  const days = monthDays(date)
  const marked = new Map<string, string>()
  for (const r of requests.filter(r=> r.status==='approved' || r.status==='pending')) {
    for (const d of days) if (inRange(d, r.start_date, r.end_date)) marked.set(d, r.status)
  }

  const monthName = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date)
  const weekdayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const firstDow = new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  const calendarCells = Array(firstDow).fill(null).concat(days)

  return (
    <AppShell title="Leave">
      <GlassCard title="Select">
        <div className="grid grid-2">
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
              {members.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
            </GlassSelect>
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Calendar" right={<div className="row" style={{gap:8}}><GlassButton variant="secondary" onClick={()=>setDate(new Date(new Date(date).setMonth(date.getMonth()-1)))}>Prev</GlassButton><GlassButton variant="secondary" onClick={()=>setDate(new Date(new Date(date).setMonth(date.getMonth()+1)))}>Next</GlassButton><GlassButton onClick={()=>setOpen(true)}>Request leave</GlassButton></div>}>
        <div className="row" style={{justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div className="title">{monthName}</div>
          <div className="row" style={{gap:8}}>
            {weekdayNames.map(w => (<span key={w} className="subtitle" style={{width:80,textAlign:'center'}}>{w}</span>))}
          </div>
        </div>
        <div className="grid grid-7">
          {calendarCells.map((cell, idx) => {
            if (cell === null) return <div key={'empty-'+idx} />
            const d = cell as string
            const status = marked.get(d)
            const bg = status ? (status === 'approved' ? 'rgba(57,255,20,0.18)' : 'rgba(255,165,0,0.18)') : 'rgba(255,255,255,0.08)'
            return (
              <div key={d} className="glass-panel" style={{padding:10,borderRadius:12, background: bg}}>
                <div className="subtitle">{new Date(d+'T00:00:00').getDate()}</div>
                {status && <div className="badge">{status === 'approved' ? 'Leave' : 'Pending'}</div>}
              </div>
            )
          })}
        </div>
      </GlassCard>

      <GlassCard title="My Requests">
        <div className="grid-1">
          {(requests||[]).map((r:any)=> (
            <div key={r.id} className="row" style={{gap:12,alignItems:'center'}}>
              <span className="badge">{r.type_code}</span>
              <span className="subtitle">{r.start_date} - {r.end_date}</span>
              <span className="badge">{r.status}</span>
              <span className="subtitle">{r.reason}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassModal open={open} title="Request Leave" onClose={()=>setOpen(false)}>
        <div className="grid grid-2">
          <div>
            <div className="label">Type</div>
            <GlassSelect value={form.type} onChange={(e:any)=>setForm({...form, type:e.target.value})}>
              <option value="">Select type</option>
              {types.map(t=> <option key={t.id} value={t.id}>{t.name}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">Reason</div>
            <input className="input" value={form.reason} onChange={e=>setForm({...form, reason:e.target.value})} />
          </div>
        </div>
        <div className="grid grid-2" style={{marginTop:12}}>
          <div>
            <div className="label">Start</div>
            <input className="input" type="date" value={form.start} onChange={e=>setForm({...form, start:e.target.value})} />
          </div>
          <div>
            <div className="label">End</div>
            <input className="input" type="date" value={form.end} onChange={e=>setForm({...form, end:e.target.value})} />
          </div>
        </div>
        <div className="row" style={{justifyContent:'flex-end',gap:8,marginTop:12}}>
          <GlassButton onClick={submit}>Submit</GlassButton>
        </div>
      </GlassModal>
    </AppShell>
  )
}
