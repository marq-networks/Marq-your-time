'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassTable from '@components/ui/GlassTable'

type Org = { id: string, orgName: string }
type Shift = { id: string, orgId: string, name: string, startTime: string, endTime: string, isOvernight: boolean, graceMinutes: number, breakMinutes: number }

export default function ShiftsSettingsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [items, setItems] = useState<Shift[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name:'', start:'09:00', end:'17:00', overnight:false, grace:0, break:0 })

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store' }); const d = await res.json(); setOrgs(d.items||[]); if(!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadShifts = async (oid: string) => { const res = await fetch(`/api/shifts?org_id=${oid}`, { cache:'no-store' }); const d = await res.json(); setItems(d.items||[]) }
  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId) loadShifts(orgId) }, [orgId])

  const addShift = async () => {
    if (!orgId || !form.name || !form.start || !form.end) return
    const res = await fetch('/api/shifts', { method:'POST', headers:{ 'Content-Type':'application/json','x-role':'admin' }, body: JSON.stringify({ org_id: orgId, name: form.name, start_time: form.start, end_time: form.end, is_overnight: form.overnight, grace_minutes: form.grace, break_minutes: form.break }) })
    if (res.ok) { setOpen(false); setForm({ name:'', start:'09:00', end:'17:00', overnight:false, grace:0, break:0 }); loadShifts(orgId) }
  }

  return (
    <AppShell title="Shift Management">
      <GlassCard title="Organization">
        <div className="grid grid-2">
          <div>
            <div className="label">Select organization</div>
            <select className="input" value={orgId} onChange={(e:any)=> setOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </select>
          </div>
          <div className="row" style={{alignItems:'end',gap:8}}>
            <GlassButton variant="primary" onClick={()=> setOpen(true)}>Add Shift</GlassButton>
          </div>
        </div>
      </GlassCard>

      <div className="grid-2 mt-5">
        {items.map(s => (
          <GlassCard key={s.id} title={s.name} right={<span className="tag-pill accent">{s.isOvernight? 'Overnight':''} {s.breakMinutes? `Break ${s.breakMinutes}m`:''} {s.graceMinutes? `Grace ${s.graceMinutes}m`:''}</span>}>
            <div className="row" style={{gap:12}}>
              <span className="tag-pill">{s.startTime} → {s.endTime}</span>
            </div>
          </GlassCard>
        ))}
      </div>

      {open && (
        <div className="modal-backdrop">
          <div className="modal glass-panel" style={{ borderRadius:'var(--radius-large)', padding:16, width:420 }}>
            <div className="card-title">Add Shift</div>
            <div className="grid grid-2" style={{marginTop:12}}>
              <div>
                <div className="label">Name</div>
                <input className="input" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
              </div>
              <div>
                <div className="label">Overnight</div>
                <input type="checkbox" checked={form.overnight} onChange={e=>setForm({...form, overnight:e.target.checked})} />
              </div>
              <div>
                <div className="label">Start</div>
                <input className="input" type="time" value={form.start} onChange={e=>setForm({...form, start:e.target.value})} />
              </div>
              <div>
                <div className="label">End</div>
                <input className="input" type="time" value={form.end} onChange={e=>setForm({...form, end:e.target.value})} />
              </div>
              <div>
                <div className="label">Grace minutes</div>
                <input className="input" type="number" value={form.grace} onChange={e=>setForm({...form, grace:Number(e.target.value)})} />
              </div>
              <div>
                <div className="label">Break minutes</div>
                <input className="input" type="number" value={form.break} onChange={e=>setForm({...form, break:Number(e.target.value)})} />
              </div>
            </div>
            <div className="row" style={{gap:8,marginTop:12}}>
              <GlassButton variant="primary" onClick={addShift}>Save</GlassButton>
              <GlassButton variant="secondary" onClick={()=> setOpen(false)}>Cancel</GlassButton>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}

