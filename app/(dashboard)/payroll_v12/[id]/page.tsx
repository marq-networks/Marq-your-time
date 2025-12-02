'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import GlassModal from '@components/ui/GlassModal'

type Period = { id: string, period_start: string, period_end: string, status: string }
type Row = { id: string, member_id: string, worked_minutes: number, extra_minutes: number, short_minutes: number, base_salary: number, overtime_amount: number, short_deduction: number, fines_total: number, adjustments_total: number, net_salary: number }

export default function PayrollDetailPageV12() {
  const path = usePathname()
  const id = path.split('/').pop() || ''
  const [period, setPeriod] = useState<Period | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [adjOpen, setAdjOpen] = useState(false)
  const [targetRow, setTargetRow] = useState<Row | null>(null)
  const [adj, setAdj] = useState({ type: 'bonus', amount: 0, reason: '' })

  const loadPeriod = async () => { /* server returns list; client filters by id */ const res = await fetch(`/api/payroll/periods/list?org_id=${''}&limit=200`, { cache:'no-store' }); const d = await res.json(); setPeriod(d.items?.find((p:any)=>p.id===id)||null) }
  const loadRows = async () => { const res = await fetch(`/api/payroll/members/list?payroll_period_id=${id}`, { cache:'no-store' }); const d = await res.json(); setRows(d.items||[]) }

  useEffect(()=>{ if(id) { loadPeriod(); loadRows() } }, [id])

  const approve = async () => { await fetch('/api/payroll/periods/approve', { method:'POST', headers:{ 'Content-Type':'application/json','x-role':'manager' }, body: JSON.stringify({ payroll_period_id: id }) }); loadRows() }
  const submitAdj = async () => { if (!targetRow) return; await fetch('/api/payroll/adjustments/add', { method:'POST', headers:{ 'Content-Type':'application/json','x-role':'manager' }, body: JSON.stringify({ member_payroll_id: targetRow.id, type: adj.type, amount: adj.amount, reason: adj.reason }) }); setAdjOpen(false); loadRows() }

  const columns = ['Member','Worked','Extra','Short','Base','Overtime','Deductions','Fines','Adjustments','Net','Actions']
  const rowsViz = rows.map(r => [ r.member_id, String(Math.round(r.worked_minutes/60)), String(Math.round(r.extra_minutes/60)), String(Math.round(r.short_minutes/60)), `$${Math.round(r.base_salary).toLocaleString()}`, `$${Math.round(r.overtime_amount).toLocaleString()}`, `$${Math.round(r.short_deduction).toLocaleString()}`, `$${Math.round(r.fines_total).toLocaleString()}`, `$${Math.round(r.adjustments_total).toLocaleString()}`, `$${Math.round(r.net_salary).toLocaleString()}`, <div className="row" style={{ gap:8 }}><GlassButton variant="secondary" onClick={()=>{ setTargetRow(r); setAdj({ type:'bonus', amount:0, reason:'' }); setAdjOpen(true) }} style={{ background:'rgba(255,255,255,0.6)' }}>Adjust</GlassButton></div> ])

  return (
    <AppShell title="Payroll Period v12">
      <GlassCard title="Period Summary">
        <div className="grid grid-3">
          <div><div className="label">Period</div><div className="subtitle">{period? `${period.period_start} → ${period.period_end}` : ''}</div></div>
          <div><div className="label">Status</div><span className="tag-pill accent">{period?.status||''}</span></div>
          <div className="row" style={{ alignItems:'end', gap:8 }}>
            <GlassButton variant="primary" onClick={()=>window.open(`/api/payroll/export?payroll_period_id=${id}&format=csv`, '_blank')} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Export CSV</GlassButton>
            <GlassButton variant="primary" onClick={()=>window.open(`/api/payroll/export?payroll_period_id=${id}&format=xlsx`, '_blank')} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Export Excel</GlassButton>
            <GlassButton variant="primary" onClick={()=>window.open(`/api/payroll/export?payroll_period_id=${id}&format=pdf`, '_blank')} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Export PDF</GlassButton>
            <GlassButton variant="primary" onClick={approve} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Approve Payroll</GlassButton>
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Member Payroll">
        <GlassTable columns={columns} rows={rowsViz} />
      </GlassCard>

      <GlassModal open={adjOpen} title="Apply Adjustment" onClose={()=>setAdjOpen(false)}>
        <div className="grid grid-3">
          <div>
            <div className="label">Type</div>
            <GlassSelect value={adj.type} onChange={(e:any)=>setAdj({...adj, type: e.target.value})}>
              <option value="bonus">Bonus</option>
              <option value="deduction">Deduction</option>
              <option value="fine">Fine</option>
            </GlassSelect>
          </div>
          <div>
            <div className="label">Amount</div>
            <input className="input" type="number" value={adj.amount} onChange={e=>setAdj({...adj, amount: Number(e.target.value)})} />
          </div>
          <div>
            <div className="label">Reason</div>
            <input className="input" value={adj.reason} onChange={e=>setAdj({...adj, reason: e.target.value})} />
          </div>
        </div>
        <div className="row" style={{ marginTop:12 }}>
          <GlassButton variant="primary" onClick={submitAdj} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Apply</GlassButton>
        </div>
      </GlassModal>
    </AppShell>
  )
}

