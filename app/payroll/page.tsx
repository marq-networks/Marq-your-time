"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import GlassModal from '@components/ui/GlassModal'
import GlassSelect from '@components/ui/GlassSelect'

type Org = { id: string, orgName: string }
type Period = { id: string, name: string, startDate: string, endDate: string, status: string }

function fmtCurrency(v: number, curr = 'USD') { try { return new Intl.NumberFormat(undefined, { style:'currency', currency: curr }).format(v) } catch { return `${curr} ${v.toFixed(2)}` } }
function fmtHM(mins: number) { const m = Math.max(0, Math.round(mins||0)); const h=Math.floor(m/60); const mm=String(m%60).padStart(2,'0'); return `${h}:${mm}` }

export default function PayrollDashboardPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [periods, setPeriods] = useState<Period[]>([])
  const [selected, setSelected] = useState<string>('')
  const [lines, setLines] = useState<any[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' })

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store' }); const d = await res.json(); setOrgs(d.items||[]); if(!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadPeriods = async (oid: string) => { const res = await fetch(`/api/payroll/periods?org_id=${oid}`, { cache:'no-store' }); const d = await res.json(); setPeriods(d.items||[]) }
  const loadSummary = async (oid: string, pid: string) => { const res = await fetch(`/api/payroll/summary?org_id=${oid}&period_id=${pid}`, { cache:'no-store' }); const d = await res.json(); setLines(d.items||[]) }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId) loadPeriods(orgId) }, [orgId])
  useEffect(()=>{ if(orgId && selected) loadSummary(orgId, selected) }, [orgId, selected])

  const columns = ['Member','Department','Scheduled','Worked','Extra','Short','Base','Extra','Short Deduction','Fines','Adjustments','Net']
  const rows = lines.map(l => [ l.memberName, l.departmentName, fmtHM(l.totalScheduledMinutes), fmtHM(l.totalWorkedMinutes), fmtHM(l.totalExtraMinutes), fmtHM(l.totalShortMinutes), fmtCurrency(l.baseEarnings, l.currency), fmtCurrency(l.extraEarnings, l.currency), fmtCurrency(l.deductionForShort, l.currency), fmtCurrency(l.finesTotal, l.currency), fmtCurrency(l.adjustmentsTotal, l.currency), fmtCurrency(l.netPayable, l.currency) ])

  const createPeriod = async () => { if(!orgId || !form.name || !form.start_date || !form.end_date) return; await fetch('/api/payroll/periods', { method:'POST', headers:{'Content-Type':'application/json','x-user-id':'admin'}, body: JSON.stringify({ org_id: orgId, ...form }) }); setCreateOpen(false); loadPeriods(orgId) }
  const generate = async (id: string) => { await fetch(`/api/payroll/periods/${id}/generate`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId }) }); loadSummary(orgId, id) }
  const lock = async (id: string) => { await fetch(`/api/payroll/periods/${id}/lock`, { method:'POST' }); loadPeriods(orgId) }
  const exportPeriod = async (id: string) => { const res = await fetch(`/api/payroll/periods/${id}/export`, { method:'POST' }); const d = await res.json(); const blob = new Blob([d.csv], { type:'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${id}.csv`; a.click() }

  return (
    <AppShell title="Payroll">
      <GlassCard title="Period Management">
        <div className="grid grid-3">
          <div>
            <div className="label">Organization</div>
            <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">Payroll Period</div>
            <GlassSelect value={selected} onChange={(e:any)=>setSelected(e.target.value)}>
              <option value="">Select period</option>
              {periods.map(p=> <option key={p.id} value={p.id}>{p.name} [{p.status}]</option>)}
            </GlassSelect>
          </div>
          <div className="row" style={{alignItems:'end', gap:8}}>
            <GlassButton onClick={()=>setCreateOpen(true)}>Create Payroll Period</GlassButton>
            {selected && (
              <>
                <GlassButton onClick={()=>generate(selected)}>Generate</GlassButton>
                <GlassButton onClick={()=>lock(selected)}>Lock</GlassButton>
                <GlassButton onClick={()=>exportPeriod(selected)}>Export</GlassButton>
              </>
            )}
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Member Payroll">
        <GlassTable columns={columns} rows={rows} />
      </GlassCard>

      <GlassModal open={createOpen} title="Create Payroll Period" onClose={()=>setCreateOpen(false)}>
        <div className="grid grid-3">
          <div>
            <div className="label">Name</div>
            <input className="input" value={form.name} onChange={e=>setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <div className="label">Start Date</div>
            <input className="input" type="date" value={form.start_date} onChange={e=>setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div>
            <div className="label">End Date</div>
            <input className="input" type="date" value={form.end_date} onChange={e=>setForm({ ...form, end_date: e.target.value })} />
          </div>
        </div>
        <div className="row" style={{marginTop:12, gap:8}}>
          <GlassButton onClick={createPeriod}>Create</GlassButton>
        </div>
      </GlassModal>
    </AppShell>
  )
}

