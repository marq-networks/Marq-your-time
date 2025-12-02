"use client"
import { useEffect, useMemo, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'

type OrgItem = { org_id: string, name: string, created_at: string, members_count: number, active_devices: number, active_seats: number, monthly_tracked_hours: number, mrr: number }
type TrendPoint = { date: string, tracked_hours: number, active_members: number, active_seats: number }

function dateISO(d: Date) { return d.toISOString().slice(0,10) }
function addDays(base: string, days: number) { const dt = new Date(base + 'T00:00:00'); dt.setDate(dt.getDate() + days); return dateISO(dt) }

function LineChart({ points, color }: { points: { date: string, value: number }[], color: string }) {
  const width = 600, height = 160, pad = 24
  const vals = points.map(p => p.value)
  const max = Math.max(1, ...vals)
  const xs = points.map((_, i) => pad + (i * (width - pad*2) / Math.max(1, points.length - 1)))
  const ys = points.map(p => height - pad - (p.value / max) * (height - pad*2))
  const d = points.length ? `M ${xs[0]},${ys[0]} ` + xs.slice(1).map((x,i) => `L ${x},${ys[i+1]}`).join(' ') : ''
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ display:'block', width:'100%' }}>
      <rect x={0} y={0} width={width} height={height} fill="rgba(255,255,255,0.12)" rx={18} />
      <path d={d} stroke={color} strokeWidth={2.5} fill="none" />
    </svg>
  )
}

export default function SuperAdminHQ() {
  const [forbidden, setForbidden] = useState(false)
  const [orgs, setOrgs] = useState<OrgItem[]>([])
  const [trends, setTrends] = useState<TrendPoint[]>([])
  const [revenue, setRevenue] = useState<any>({ mrr:0, arr:0, monthly:[], org_breakdown:[] })
  const [devices, setDevices] = useState<any[]>([])
  const [top, setTop] = useState<any[]>([])
  const [start, setStart] = useState(addDays(dateISO(new Date()), -29))
  const [end, setEnd] = useState(dateISO(new Date()))
  const [sort, setSort] = useState('mrr')
  const [search, setSearch] = useState('')

  const loadAll = async () => {
    const hdr = { 'x-role': 'super_admin' }
    const oRes = await fetch('/api/hq/organizations', { headers: hdr, cache:'no-store' })
    if (oRes.status === 403) { setForbidden(true); return }
    const o = await oRes.json()
    setOrgs(o.orgs || [])
    const uRes = await fetch(`/api/hq/usage-trends?start=${start}&end=${end}`, { headers: hdr, cache:'no-store' })
    const u = await uRes.json()
    setTrends(u.points || [])
    const rRes = await fetch('/api/hq/revenue', { headers: hdr, cache:'no-store' })
    const r = await rRes.json()
    setRevenue(r)
    const dRes = await fetch('/api/hq/devices', { headers: hdr, cache:'no-store' })
    const d = await dRes.json()
    setDevices(d.devices || [])
    const tRes = await fetch(`/api/hq/top-organizations?metric=${sort}`, { headers: hdr, cache:'no-store' })
    const t = await tRes.json()
    setTop(t.top || [])
  }

  useEffect(() => { loadAll() }, [])
  useEffect(() => { loadAll() }, [start, end, sort])

  const filteredOrgs = useMemo(() => orgs.filter(o => !search || o.name.toLowerCase().includes(search.toLowerCase())), [orgs, search])
  const totalActiveOrgs = filteredOrgs.length
  const totalActiveUsers = filteredOrgs.reduce((s,o)=> s + o.members_count, 0)
  const totalTrackedHours = filteredOrgs.reduce((s,o)=> s + o.monthly_tracked_hours, 0)

  if (forbidden) {
    return (
      <AppShell title="Super Admin HQ">
        <div style={{display:'grid',placeItems:'center',height:'60vh'}}>
          <div className="glass-panel" style={{padding:24,borderRadius:'var(--radius-large)'}}>
            <div className="title">Access Denied</div>
            <div className="subtitle">You must be a Super Admin to view MARQ HQ.</div>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Super Admin HQ">
      <GlassCard title="Filters" right={(
        <div className="row" style={{gap:12}}>
          <GlassButton variant="primary" onClick={()=>{ const s = addDays(dateISO(new Date()), -6); setStart(s); setEnd(dateISO(new Date())) }} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Last 7 days</GlassButton>
          <GlassButton variant="primary" onClick={()=>{ const s = addDays(dateISO(new Date()), -29); setStart(s); setEnd(dateISO(new Date())) }} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Last 30 days</GlassButton>
        </div>
      )}>
        <div className="grid-1">
          <div>
            <div className="label">Date Range</div>
            <div className="row" style={{gap:10}}>
              <input className="input" type="date" value={start} onChange={e=>setStart(e.target.value)} />
              <input className="input" type="date" value={end} onChange={e=>setEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <div className="label">Sort by</div>
            <GlassSelect value={sort} onChange={(e:any)=>setSort(e.target.value)}>
              <option value="mrr">MRR</option>
              <option value="arr">ARR</option>
              <option value="hours">Tracked hours</option>
              <option value="members">Active members</option>
              <option value="growth">Usage growth</option>
            </GlassSelect>
          </div>
          <div>
            <div className="label">Organization search</div>
            <input className="input" placeholder="Search org" value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
        </div>
      </GlassCard>

      <div className="grid-4 mt-5">
        <div className="glass-panel" style={{padding:20,borderRadius:28,background:'linear-gradient(135deg,#f6d9b2,#efe6d6,#dcc9ad)'}}>
          <div className="card-title">Total Active Organizations</div>
          <div className="title" style={{color:'#39FF14'}}>{totalActiveOrgs}</div>
        </div>
        <div className="glass-panel" style={{padding:20,borderRadius:28,background:'linear-gradient(135deg,#f6d9b2,#efe6d6,#dcc9ad)'}}>
          <div className="card-title">Global MRR / ARR</div>
          <div className="row" style={{gap:16}}>
            <div className="title" style={{color:'#39FF14'}}>${Math.round(revenue.mrr||0).toLocaleString()}</div>
            <div className="title">/${Math.round(revenue.arr||0).toLocaleString()}</div>
          </div>
        </div>
        <div className="glass-panel" style={{padding:20,borderRadius:28,background:'linear-gradient(135deg,#f6d9b2,#efe6d6,#dcc9ad)'}}>
          <div className="card-title">Total Active Users</div>
          <div className="title" style={{color:'#39FF14'}}>{totalActiveUsers}</div>
        </div>
        <div className="glass-panel" style={{padding:20,borderRadius:28,background:'linear-gradient(135deg,#f6d9b2,#efe6d6,#dcc9ad)'}}>
          <div className="card-title">Total Monthly Tracked Hours</div>
          <div className="title" style={{color:'#39FF14'}}>{totalTrackedHours}</div>
        </div>
      </div>

      <GlassCard title="Organization Directory">
        <GlassTable
          columns={["Organization name","Created date","Members","Seats","Tracked hours","MRR","Actions"]}
          rows={filteredOrgs.map(o => [
            o.name,
            new Date(o.created_at).toLocaleDateString(),
            String(o.members_count),
            String(o.active_seats),
            String(o.monthly_tracked_hours),
            `$${Math.round(o.mrr||0).toLocaleString()}`,
            <GlassButton key={o.org_id} variant="primary" href={`/hq/org/${o.org_id}`} style={{ background:'#39FF14', borderColor:'#39FF14' }}>View Org</GlassButton>
          ])}
        />
      </GlassCard>

      <GlassCard title="Cross-Org Usage Trends">
        <LineChart points={trends.map(p => ({ date: p.date, value: p.tracked_hours }))} color="#0f6a50" />
        <div className="row" style={{gap:16,marginTop:12}}>
          <span className="tag-pill accent">Members {trends.reduce((s,p)=> s + p.active_members, 0)}</span>
          <span className="tag-pill accent">Seats {trends[0]?.active_seats || 0}</span>
        </div>
      </GlassCard>

      <div className="grid-2 mt-5">
        <GlassCard title="Monthly Revenue">
          <LineChart points={(revenue.monthly||[]).map((m:any)=>({ date:m.month, value:m.revenue }))} color="#39FF14" />
        </GlassCard>
        <GlassCard title="Revenue per Organization">
          <GlassTable columns={["Organization","Revenue"]} rows={(revenue.org_breakdown||[]).map((r:any)=> [r.org_name, `$${Math.round(r.revenue||0).toLocaleString()}`])} />
        </GlassCard>
      </div>

      <GlassCard title="Devices Across Organizations">
        <GlassTable columns={["Device name","OS","Org","Last seen","Status","Active sessions"]} rows={devices.map(d => [
          d.device_name,
          d.device_os,
          d.org_name,
          new Date(d.last_seen).toLocaleString(),
          d.status,
          String(d.active_sessions || 0)
        ])} />
      </GlassCard>

      <GlassCard title="Top Performing Organizations">
        <div className="grid-auto">
          {top.map((t:any)=> (
            <div key={`${t.org_id}-${t.rank_metric}`} className="glass-panel" style={{padding:16,borderRadius:28}}>
              <div className="card-title">{t.name}</div>
              <div className="subtitle">{t.rank_metric.toUpperCase()}</div>
              <div className="title" style={{color:'#39FF14'}}>{t.value}</div>
            </div>
          ))}
        </div>
      </GlassCard>
    </AppShell>
  )
}

