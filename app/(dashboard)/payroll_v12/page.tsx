'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'
import GlassModal from '@components/ui/GlassModal'
import { normalizeRoleForApi } from '@lib/permissions'

type Org = { id: string, orgName: string }
type Period = { id: string, period_start: string, period_end: string, status: string }

export default function PayrollHomePageV12() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [periods, setPeriods] = useState<Period[]>([])
  const [selected, setSelected] = useState<string>('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ start: '', end: '' })
  const role = typeof document !== 'undefined' ? normalizeRoleForApi(document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store' }); const d = await res.json(); setOrgs(d.items||[]) }
  const loadPeriods = async (oid: string) => { const res = await fetch(`/api/payroll/periods/list?org_id=${oid}&limit=50`, { cache:'no-store' }); const d = await res.json(); setPeriods(d.items||[]) }

  const createPeriod = async () => {
    if (!orgId || !form.start || !form.end) return
    const res = await fetch('/api/payroll/periods/create', { method:'POST', headers:{ 'Content-Type':'application/json','x-role': role || 'admin' }, body: JSON.stringify({ org_id: orgId, period_start: form.start, period_end: form.end }) })
    if (res.ok) { setCreateOpen(false); setForm({ start:'', end:'' }); loadPeriods(orgId) }
  }
  const generate = async (id: string) => { await fetch('/api/payroll/periods/generate', { method:'POST', headers:{ 'Content-Type':'application/json','x-role': role || 'admin' }, body: JSON.stringify({ payroll_period_id: id, org_id: orgId }) }); loadPeriods(orgId) }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if (orgId) loadPeriods(orgId) }, [orgId])

  const columns = ['Period','Status','Actions']
  const rows = periods.map(p => [ `${p.period_start} → ${p.period_end}`, p.status, <div className="row" style={{ gap:8 }}><GlassButton variant="primary" onClick={()=>{ setSelected(p.id) }} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Open</GlassButton><GlassButton variant="primary" onClick={()=>generate(p.id)} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Generate</GlassButton></div> ])

  return (
    <AppShell title="Payroll v12">
      <GlassCard title="Payroll Periods">
        <div className="grid grid-3">
          <div>
            <div className="label">Organization</div>
            <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
          </div>
          <div className="row" style={{ alignItems:'end', gap:8 }}>
            <GlassButton variant="primary" onClick={()=>setCreateOpen(true)} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Create Period</GlassButton>
            {selected && <GlassButton variant="secondary" href={`/payroll_v12/${selected}`} style={{ background:'rgba(255,255,255,0.6)' }}>Open Selected</GlassButton>}
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Periods List">
        <GlassTable columns={columns} rows={rows} />
      </GlassCard>

      <GlassModal open={createOpen} title="Create Payroll Period" onClose={()=>setCreateOpen(false)}>
        <div className="grid grid-2">
          <div>
            <div className="label">Start</div>
            <input className="input" type="date" value={form.start} onChange={e=>setForm({...form, start: e.target.value})} />
          </div>
          <div>
            <div className="label">End</div>
            <input className="input" type="date" value={form.end} onChange={e=>setForm({...form, end: e.target.value})} />
          </div>
        </div>
        <div className="row" style={{ marginTop:12 }}>
          <GlassButton variant="primary" onClick={createPeriod} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Create</GlassButton>
        </div>
      </GlassModal>
    </AppShell>
  )
}
