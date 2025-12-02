"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'

export default function OrgDetail({ params }: { params: { id: string } }) {
  const [org, setOrg] = useState<any>(null)
  const [revenue, setRevenue] = useState<any>(null)
  const [forbidden, setForbidden] = useState(false)

  const load = async () => {
    const hdr = { 'x-role': 'super_admin' }
    const oRes = await fetch('/api/hq/organizations', { headers: hdr, cache:'no-store' })
    if (oRes.status === 403) { setForbidden(true); return }
    const o = await oRes.json()
    const found = (o.orgs||[]).find((x:any)=> x.org_id === params.id)
    setOrg(found || null)
    const rRes = await fetch('/api/hq/revenue', { headers: hdr, cache:'no-store' })
    const r = await rRes.json()
    setRevenue(r)
  }

  useEffect(() => { load() }, [])

  if (forbidden) {
    return (
      <AppShell title="Org Details">
        <div style={{display:'grid',placeItems:'center',height:'60vh'}}>
          <div className="glass-panel" style={{padding:24,borderRadius:'var(--radius-large)'}}>
            <div className="title">Access Denied</div>
            <div className="subtitle">You must be a Super Admin to view MARQ HQ.</div>
          </div>
        </div>
      </AppShell>
    )
  }

  if (!org) return <AppShell title="Org Details"><div className="glass-panel" style={{padding:20,borderRadius:28}}>Loading...</div></AppShell>

  return (
    <AppShell title="Organization Details">
      <div className="grid-3">
        <GlassCard title="Org Info">
          <div className="title">{org.name}</div>
          <div className="subtitle">Created {new Date(org.created_at).toLocaleDateString()}</div>
          <div className="subtitle">Members {org.members_count} • Devices {org.active_devices}</div>
        </GlassCard>
        <GlassCard title="Usage (30 days)">
          <div className="title">Tracked Hours {org.monthly_tracked_hours}</div>
          <div className="subtitle">Active Seats {org.active_seats}</div>
        </GlassCard>
        <GlassCard title="Revenue">
          <div className="title">MRR ${Math.round(org.mrr||0).toLocaleString()}</div>
        </GlassCard>
      </div>
      <div className="row" style={{marginTop:12}}>
        <GlassButton variant="primary" href={`/dashboard?org_id=${org.org_id}`} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Open Org Dashboard</GlassButton>
      </div>
      <div className="grid-1" style={{marginTop:20}}>
        <GlassCard title="Revenue (Monthly)">
          <GlassTable columns={["Month","Revenue"]} rows={(revenue?.monthly||[]).filter((m:any)=>m.revenue>0).map((m:any)=> [m.month, `$${Math.round(m.revenue||0).toLocaleString()}`])} />
        </GlassCard>
      </div>
    </AppShell>
  )
}

