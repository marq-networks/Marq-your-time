'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassModal from '@components/ui/GlassModal'
import GlassSelect from '@components/ui/GlassSelect'
import { normalizeRoleForApi } from '@lib/permissions'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'

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
  const [role, setRole] = useState('')
  const [selStart, setSelStart] = useState<string>('')
  const [selEnd, setSelEnd] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [seeded, setSeeded] = useState(false)
  const [month, setMonth] = useState<Date>(() => new Date())
  const [range, setRange] = useState<{ from?: Date, to?: Date } | undefined>(undefined)

  const loadOrgs = async () => {
    const endpoint = role === 'super_admin' ? '/api/org/list' : '/api/orgs/my'
    const res = await fetch(endpoint, { cache:'no-store' })
    const d = await res.json()
    const items: Org[] = Array.isArray(d.items) ? (d.items as Org[]) : []
    setOrgs(items)
    if (!orgId && items.length) {
      const cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
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
      const cookieUserId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('current_user_id='))?.split('=')[1] || '') : ''
      const preferredMember = items.find(m => m.id === cookieUserId)?.id || items[0].id
      setMemberId(preferredMember)
    }
  }
  const loadTypes = async (oid: string) => { const res = await fetch(`/api/leave/types?org_id=${oid}`, { cache:'no-store' }); const d = await res.json(); const items = d.items||[]; setTypes(items); if (!form.type && items.length) setForm((f:any)=> ({ ...f, type: items[0].id })) }
  const loadMy = async (mid: string) => { const res = await fetch(`/api/leave/my-requests?member_id=${mid}`, { cache:'no-store' }); const d = await res.json(); setRequests(d.items||[]) }
  const submit = async () => {
    if(!orgId || !memberId) { setSubmitError('Missing organization or member'); return }
    if(!form.type) { setSubmitError('Please select a leave type'); return }
    if(!form.start || !form.end) { setSubmitError('Please select start and end dates'); return }
    if (form.end < form.start) { setSubmitError('End date cannot be before start date'); return }
    setSubmitting(true);
    setSubmitError('');
    const res = await fetch('/api/leave/request', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-user-id': memberId }, body: JSON.stringify({ org_id: orgId, member_id: memberId, leave_type_id: form.type, start_date: form.start, end_date: form.end, reason: form.reason }) });
    if (res.ok) {
      setOpen(false);
      setForm({ type: form.type, start:'', end:'', reason:'' })
      setSelStart(''); setSelEnd('');
      await loadMy(memberId)
    } else {
      try { const d = await res.json(); setSubmitError(d.error || 'Request failed') } catch { setSubmitError('Request failed') }
    }
    setSubmitting(false);
  }

  useEffect(()=>{ try { const r = normalizeRoleForApi((typeof document !== 'undefined' ? (document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('current_role='))?.split('=')[1] || '') : '')); setRole(r) } catch {} }, [])
  useEffect(()=>{ loadOrgs() }, [role])
  useEffect(()=>{ if(orgId) { loadMembers(orgId); loadTypes(orgId) } }, [orgId])
  useEffect(()=>{ if(memberId) loadMy(memberId) }, [memberId])
  useEffect(()=>{ if (!form.type && types.length) setForm((f:any)=> ({ ...f, type: types[0].id })) }, [types])
  useEffect(()=>{ 
    if (orgId && types.length === 0 && !seeded) {
      (async () => {
        const defs = [
          { code:'SICK', name:'Sick Leave', paid:true, default_days_per_year:10 },
          { code:'CASUAL', name:'Casual Leave', paid:true, default_days_per_year:12 },
          { code:'ANNUAL', name:'Annual Leave', paid:true, default_days_per_year:20 },
          { code:'UNPAID', name:'Unpaid Leave', paid:false, default_days_per_year:0 },
        ]
        for (const d of defs) {
          await fetch('/api/leave/types/create', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-role': 'super_admin' }, body: JSON.stringify({ org_id: orgId, ...d }) })
        }
        setSeeded(true)
        await loadTypes(orgId)
      })()
    }
  }, [types, orgId, seeded])

  const days = monthDays(date)
  const marked = new Map<string, string>()
  for (const r of requests.filter(r=> r.status==='approved' || r.status==='pending')) {
    for (const d of days) if (inRange(d, r.start_date, r.end_date)) marked.set(d, r.status)
  }

  return (
    <AppShell title="Leave">
      <GlassCard title="Select">
        <div className="grid grid-2">
          <div>
            <div className="label">Organization</div>
            {(['employee','member'].includes(role)) ? (
              <span className="tag-pill">{orgs.find(o => o.id === orgId)?.orgName || orgs[0]?.orgName || ''}</span>
            ) : (
              <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
                <option value="">Select org</option>
                {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
              </GlassSelect>
            )}
          </div>
          <div>
            <div className="label">Member</div>
            {(['employee','member'].includes(role)) ? (
              <span className="tag-pill">
                {members.find(m => m.id === memberId) ? `${members.find(m => m.id === memberId)!.firstName} ${members.find(m => m.id === memberId)!.lastName}` : 'Me'}
              </span>
            ) : (
              <GlassSelect value={memberId} onChange={(e:any)=>setMemberId(e.target.value)}>
                <option value="">Select member</option>
                {members.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
              </GlassSelect>
            )}
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Calendar" right={<div className="row" style={{gap:8}}>
        <GlassButton variant="secondary" onClick={()=>{ const dt = new Date(new Date(month).setMonth(month.getMonth()-1)); setMonth(dt); setSelStart(''); setSelEnd(''); setRange(undefined) }}>Prev</GlassButton>
        <GlassButton variant="secondary" onClick={()=>{ const dt = new Date(new Date(month).setMonth(month.getMonth()+1)); setMonth(dt); setSelStart(''); setSelEnd(''); setRange(undefined) }}>Next</GlassButton>
        <GlassButton onClick={()=>{ 
          if (selStart && selEnd) setForm((f:any)=> ({ ...f, start: selStart, end: selEnd, type: f.type || (types[0]?.id || '') }));
          else setForm((f:any)=> ({ ...f, type: f.type || (types[0]?.id || '') }));
          setOpen(true) 
        }}>Request leave</GlassButton>
      </div>}>
        {(() => {
          function rangeDates(s: string, e: string) { const out: Date[] = []; if (!s || !e) return out; for (let d = new Date(s+'T00:00:00'); d <= new Date(e+'T00:00:00'); d = new Date(d.getTime()+24*60*60*1000)) out.push(new Date(d)); return out }
          const pending: Date[] = []; const approved: Date[] = []
          for (const r of requests) {
            if (r.status === 'approved') approved.push(...rangeDates(r.start_date, r.end_date))
            else if (r.status === 'pending') pending.push(...rangeDates(r.start_date, r.end_date))
          }
          return (
            <DayPicker
              month={month}
              onMonthChange={setMonth}
              mode="range"
              selected={range}
              onSelect={(r)=>{ setRange(r||undefined); const s = r?.from ? r.from.toISOString().slice(0,10) : ''; const e = r?.to ? r.to.toISOString().slice(0,10) : ''; setSelStart(s); setSelEnd(e) }}
              modifiers={{ pending, approved }}
              modifiersStyles={{ pending: { backgroundColor: 'rgba(255,165,0,0.18)' }, approved: { backgroundColor: 'rgba(57,255,20,0.18)' } }}
              showOutsideDays
            />
          )
        })()}
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
            {types.length === 0 && (
              <div className="row" style={{gap:8,marginTop:8,alignItems:'center'}}>
                <span className="subtitle">No leave types configured</span>
                {(['admin','owner','super_admin'].includes(role)) && (
                  <GlassButton variant="secondary" onClick={async ()=>{
                    if (!orgId) return
                    const defs = [
                      { code:'SICK', name:'Sick Leave', paid:true, default_days_per_year:10 },
                      { code:'CASUAL', name:'Casual Leave', paid:true, default_days_per_year:12 },
                      { code:'ANNUAL', name:'Annual Leave', paid:true, default_days_per_year:20 },
                      { code:'UNPAID', name:'Unpaid Leave', paid:false, default_days_per_year:0 },
                    ]
                    for (const d of defs) {
                      const roleHeader = role === 'super_admin' ? 'super_admin' : 'org_admin'
                      await fetch('/api/leave/types/create', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-role': roleHeader }, body: JSON.stringify({ org_id: orgId, ...d }) })
                    }
                    await loadTypes(orgId)
                  }}>Add defaults</GlassButton>
                )}
              </div>
            )}
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
        {submitError && <div className="subtitle" style={{color:'tomato',marginTop:8}}>{submitError}</div>}
        <div className="row" style={{justifyContent:'flex-end',gap:8,marginTop:12}}>
          <GlassButton onClick={submit} disabled={submitting}>Submit</GlassButton>
        </div>
      </GlassModal>
    </AppShell>
  )
}
