"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'

function LineChart({ points, color }: { points: { date: string, value: number }[], color: string }) {
  const max = Math.max(1, ...points.map(p => p.value))
  return (
    <div style={{ width: '100%', height: 120, position: 'relative' }}>
      <svg width="100%" height="120" viewBox={`0 0 ${Math.max(points.length-1,1)*40} 120`} preserveAspectRatio="none">
        {points.map((p, i) => i > 0 ? (
          <line key={i} x1={(i-1)*40} y1={120 - (points[i-1].value/max)*100} x2={i*40} y2={120 - (p.value/max)*100} stroke={color} strokeWidth={3} />
        ) : null)}
      </svg>
    </div>
  )
}

export default function HQBillingPage() {
  const [data, setData] = useState<any>({ mrr: 0, arr: 0, seat_utilization: 0, orgs: [], monthly: [] })
  const [forbidden, setForbidden] = useState(false)

  const load = async () => {
    const hdr = { 'x-role': 'super_admin' }
    const res = await fetch('/api/hq/revenue', { headers: hdr, cache: 'no-store' })
    if (res.status === 403) { setForbidden(true); return }
    const d = await res.json()
    setData(d)
  }

  useEffect(()=>{ load() }, [])

  if (forbidden) {
    return (
      <AppShell title="HQ Billing">
        <div style={{display:'grid',placeItems:'center',height:'60vh'}}>
          <div className="glass-panel" style={{padding:24,borderRadius:28,border:'1px solid rgba(255,255,255,0.35)',backdropFilter:'blur(12px)'}}>
            <div className="title">Access Denied</div>
            <div className="subtitle">You must be a Super Admin to view this page.</div>
          </div>
        </div>
      </AppShell>
    )
  }

  const columns = ["Organization","Plan","Seats","MRR","ARR","Status"]
  const rows = (data.orgs||[]).map((o:any)=> [ o.org_name, o.plan_code, String(o.seats||0), `$${Math.round(o.mrr||0).toLocaleString()}`, `$${Math.round(o.arr||0).toLocaleString()}`, <span className="badge">{o.status}</span> ])

  return (
    <AppShell title="HQ Billing">
      <div className="grid-3">
        <div className="glass-panel bg-gradient-to-br from-[#d9c7b2] via-[#e8ddce] to-[#c9b8a4]" style={{padding:20,borderRadius:28,border:'1px solid rgba(255,255,255,0.35)',backdropFilter:'blur(12px)'}}>
          <div className="card-title">Total MRR</div>
          <div className="title" style={{color:'#39FF14'}}>${Math.round(data.mrr||0).toLocaleString()}</div>
        </div>
        <div className="glass-panel bg-gradient-to-br from-[#d9c7b2] via-[#e8ddce] to-[#c9b8a4]" style={{padding:20,borderRadius:28,border:'1px solid rgba(255,255,255,0.35)',backdropFilter:'blur(12px)'}}>
          <div className="card-title">ARR Forecast</div>
          <div className="title" style={{color:'#39FF14'}}>${Math.round(data.arr||0).toLocaleString()}</div>
        </div>
        <div className="glass-panel bg-gradient-to-br from-[#d9c7b2] via-[#e8ddce] to-[#c9b8a4]" style={{padding:20,borderRadius:28,border:'1px solid rgba(255,255,255,0.35)',backdropFilter:'blur(12px)'}}>
          <div className="card-title">Seat Utilization</div>
          <div className="title" style={{color:'#39FF14'}}>{Math.round(data.seat_utilization||0)}%</div>
        </div>
      </div>

      <GlassCard title="MRR Trend">
        <LineChart points={(data.monthly||[]).map((m:any)=>({ date:m.month, value: m.revenue }))} color="#39FF14" />
      </GlassCard>

      <GlassCard title="Organizations">
        <GlassTable columns={columns} rows={rows} />
      </GlassCard>
    </AppShell>
  )
}

