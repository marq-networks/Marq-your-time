"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import GlassModal from '@components/ui/GlassModal'
import GlassSelect from '@components/ui/GlassSelect'
import { normalizeRoleForApi } from '@lib/permissions'

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
  const [fineOpen, setFineOpen] = useState(false)
  const [fineTarget, setFineTarget] = useState<{ memberId: string, currency: string } | null>(null)
  const [fineForm, setFineForm] = useState({ date: '', amount: 0, reason: '' })
  const role = typeof document !== 'undefined' ? normalizeRoleForApi(document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''
 
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
  const loadPeriods = async (oid: string) => { const res = await fetch(`/api/payroll/periods?org_id=${oid}`, { cache:'no-store' }); const d = await res.json(); setPeriods(d.items||[]) }
  const loadSummary = async (oid: string, pid: string) => { const res = await fetch(`/api/payroll/summary?org_id=${oid}&period_id=${pid}`, { cache:'no-store' }); const d = await res.json(); setLines(d.items||[]) }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId) loadPeriods(orgId) }, [orgId])
  useEffect(()=>{ if(orgId && selected) loadSummary(orgId, selected) }, [orgId, selected])

  const openFine = (line: any) => {
    const today = new Date().toISOString().slice(0,10)
    setFineTarget({ memberId: line.memberId, currency: line.currency || 'USD' })
    setFineForm({ date: today, amount: 0, reason: '' })
    setFineOpen(true)
  }

  const submitFine = async () => {
    if (!orgId || !selected || !fineTarget || !fineForm.date || !fineForm.reason || !fineForm.amount) return
    const actorId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_user_id='))?.split('=')[1] || '') : ''
    const headers: Record<string,string> = { 'Content-Type':'application/json' }
    if (actorId) headers['x-user-id'] = actorId
    headers['x-role'] = role || 'admin'
    const res = await fetch('/api/payroll/fines', { method:'POST', headers, body: JSON.stringify({ org_id: orgId, member_id: fineTarget.memberId, date: fineForm.date, reason: fineForm.reason, amount: fineForm.amount, currency: fineTarget.currency || 'USD' }) })
    if (!res.ok) {
      try {
        const body = await res.json()
        alert(body.error || 'Failed to add fine')
      } catch {
        alert('Failed to add fine')
      }
      return
    }
    setFineOpen(false)
    setFineForm({ date: '', amount: 0, reason: '' })
    loadSummary(orgId, selected)
  }

  const columns = ['Member','Department','Scheduled','Worked','Extra','Short','Base','Extra','Short Deduction','Fines','Adjustments','Net','Actions']
  const rows = lines.map(l => [
    l.memberName,
    l.departmentName,
    fmtHM(l.totalScheduledMinutes),
    fmtHM(l.totalWorkedMinutes),
    fmtHM(l.totalExtraMinutes),
    fmtHM(l.totalShortMinutes),
    fmtCurrency(l.baseEarnings, l.currency),
    fmtCurrency(l.extraEarnings, l.currency),
    fmtCurrency(l.deductionForShort, l.currency),
    fmtCurrency(l.finesTotal, l.currency),
    fmtCurrency(l.adjustmentsTotal, l.currency),
    fmtCurrency(l.netPayable, l.currency),
    <GlassButton key={l.memberId} onClick={()=>openFine(l)}>Add Fine</GlassButton>
  ])

  const createPeriod = async () => {
    if(!orgId || !form.name || !form.start_date || !form.end_date) return
    const actorId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_user_id='))?.split('=')[1] || '') : ''
    const headers: Record<string,string> = { 'Content-Type':'application/json' }
    if (actorId) headers['x-user-id'] = actorId
    const res = await fetch('/api/payroll/periods', { method:'POST', headers, body: JSON.stringify({ org_id: orgId, ...form }) })
    if (!res.ok) {
      try {
        const body = await res.json()
        alert(body.error || 'Failed to create payroll period')
      } catch {
        alert('Failed to create payroll period')
      }
      return
    }
    setCreateOpen(false)
    loadPeriods(orgId)
  }
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

      <GlassModal open={fineOpen} title="Add Fine" onClose={()=>setFineOpen(false)}>
        <div className="grid grid-3">
          <div>
            <div className="label">Date</div>
            <input className="input" type="date" value={fineForm.date} onChange={e=>setFineForm({ ...fineForm, date: e.target.value })} />
          </div>
          <div>
            <div className="label">Amount</div>
            <input className="input" type="number" value={fineForm.amount} onChange={e=>setFineForm({ ...fineForm, amount: Number(e.target.value) })} />
          </div>
          <div>
            <div className="label">Reason</div>
            <input className="input" value={fineForm.reason} onChange={e=>setFineForm({ ...fineForm, reason: e.target.value })} />
          </div>
        </div>
        <div className="row" style={{ marginTop:12, gap:8 }}>
          <GlassButton onClick={submitFine}>Add Fine</GlassButton>
        </div>
      </GlassModal>
    </AppShell>
  )
}
