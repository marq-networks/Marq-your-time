"use client"
import { useEffect, useMemo, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import GlassTable from '@components/ui/GlassTable'

type Org = { id: string, orgName: string }

function dateISO(d: Date) { return d.toISOString().slice(0,10) }
function rangeQuick(key: '7'|'30') { const end = new Date(); const start = new Date(end.getTime() - (key==='7'? 6:29)*24*60*60*1000); return { start: dateISO(start), end: dateISO(end) } }

export default function HQReportsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [start, setStart] = useState<string>(rangeQuick('7').start)
  const [end, setEnd] = useState<string>(rangeQuick('7').end)
  const [mrr, setMrr] = useState(0)
  const [arr, setArr] = useState(0)
  const [util, setUtil] = useState(0)
  const [orgBreakdown, setOrgBreakdown] = useState<any[]>([])
  const [downloading, setDownloading] = useState(false)

  const loadOrgs = async () => { const r = await fetch('/api/hq/organizations', { cache:'no-store', headers:{ 'x-role':'super_admin' } }); const d = await r.json(); const items = (d.orgs||[]).map((o:any)=>({ id:o.org_id, orgName:o.org_name })); setOrgs(items) }
  const loadAgg = async () => { const r = await fetch('/api/hq/revenue', { cache:'no-store', headers:{ 'x-role':'super_admin' } }); const d = await r.json(); setMrr(Number(d.mrr||0)); setArr(Number(d.arr||0)); setUtil(Number(d.seat_utilization||0)); setOrgBreakdown(d.orgs||[]) }

  const generateBillingCSV = async () => {
    if (!orgId) return
    setDownloading(true)
    const payload: any = { org_id: orgId, report_type: 'billing', format: 'csv', params: { date_start: start, date_end: end } }
    const res = await fetch('/api/reports/generate', { method:'POST', headers:{ 'Content-Type':'application/json','x-role':'super_admin' }, body: JSON.stringify(payload) })
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `billing_${start}_${end}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
    setDownloading(false)
  }

  useEffect(()=>{ loadOrgs(); loadAgg() }, [])

  return (
    <AppShell title="HQ Reports">
      <GlassCard title="Global Metrics">
        <div className="grid-3">
          <div className="glass-panel" style={{padding:20,borderRadius:28}}>
            <div className="card-title">Global MRR</div>
            <div className="title">${Math.round(mrr||0).toLocaleString()}</div>
          </div>
          <div className="glass-panel" style={{padding:20,borderRadius:28}}>
            <div className="card-title">Global ARR</div>
            <div className="title">${Math.round(arr||0).toLocaleString()}</div>
          </div>
          <div className="glass-panel" style={{padding:20,borderRadius:28}}>
            <div className="card-title">Seat Utilization</div>
            <div className="title">{Math.round(util||0)}%</div>
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Organizations by Plan and Revenue">
        <GlassTable columns={["Organization","Plan","Seats","MRR","ARR","Status"]} rows={(orgBreakdown||[]).map((o:any)=>[
          o.org_name,
          o.plan_code,
          String(o.seats||0),
          `$${Math.round(o.mrr||0).toLocaleString()}`,
          `$${Math.round(o.arr||0).toLocaleString()}`,
          o.status
        ])} />
      </GlassCard>

      <GlassCard title="Export Billing CSV">
        <div className="grid-3">
          <div>
            <div className="label">Organization</div>
            <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">Date start</div>
            <input className="input" type="date" value={start} onChange={e=>setStart(e.target.value)} />
          </div>
          <div>
            <div className="label">Date end</div>
            <input className="input" type="date" value={end} onChange={e=>setEnd(e.target.value)} />
          </div>
        </div>
        <div className="row" style={{ marginTop:12 }}>
          <GlassButton variant="primary" onClick={generateBillingCSV} style={{ background:'#39FF14', borderColor:'#39FF14' }}>{downloading? 'Generating...' : 'Generate & Download'}</GlassButton>
        </div>
      </GlassCard>
    </AppShell>
  )
}

