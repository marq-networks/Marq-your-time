'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'

type Org = { id: string, orgName: string }
type DeviceRow = { device_name: string, org: string, agent_version?: string | null, update_status?: string | null, last_seen?: string | null }

export default function AgentVersionsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [status, setStatus] = useState('')
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [minVer, setMinVer] = useState('')
  const [dlUrl, setDlUrl] = useState('')
  const [blockBelow, setBlockBelow] = useState(false)

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store' }); const d = await res.json(); setOrgs(d.items||[]) }
  const loadMin = async () => { const res = await fetch('/api/hq/agent-version/minimum', { cache:'no-store', headers:{ 'x-role':'super_admin' }}); const d = await res.json(); setMinVer(d.minimum_version||''); setDlUrl(d.download_url||''); setBlockBelow(!!d.block_below) }
  const loadDevices = async (oid: string, st: string) => {
    const params = new URLSearchParams()
    if (oid) params.set('org', oid)
    if (st) params.set('status', st)
    const qs = params.toString()
    const res = await fetch(`/api/hq/agent-version/devices${qs?`?${qs}`:''}`, { cache:'no-store', headers:{ 'x-role':'super_admin' }})
    const d = await res.json()
    setDevices(d.devices||[])
  }

  useEffect(()=>{ loadOrgs(); loadMin() }, [])
  useEffect(()=>{ loadDevices(orgId, status) }, [orgId, status])

  const saveMin = async () => {
    await fetch('/api/hq/agent-version/minimum', { method:'POST', headers:{ 'Content-Type':'application/json','x-role':'super_admin' }, body: JSON.stringify({ minimum_version: minVer, download_url: dlUrl, block_below: blockBelow }) })
    await loadMin()
    await loadDevices(orgId, status)
  }

  const columns = ['Device','Organization','Agent Version','Status','Last Seen']
  const rows = devices.map(d => [ d.device_name, d.org, d.agent_version || '-', <span className="badge">{d.update_status || 'unknown'}</span>, d.last_seen ? new Date(d.last_seen).toLocaleString() : '-' ])

  return (
    <AppShell title="Agent Versions">
      <GlassCard title="Filters">
        <div className="grid grid-3">
          <div>
            <div className="label">Organization</div>
            <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
              <option value="">All</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">Status</div>
            <GlassSelect value={status} onChange={(e:any)=>setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="ok">ok</option>
              <option value="outdated">outdated</option>
              <option value="blocked">blocked</option>
            </GlassSelect>
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Devices">
        <GlassTable columns={columns} rows={rows} />
      </GlassCard>

      <GlassCard title="Minimum Agent Version" right={<GlassButton variant="primary" onClick={saveMin}>Save</GlassButton>}>
        <div className="grid grid-3">
          <div>
            <div className="label">Minimum Version</div>
            <input className="input" value={minVer} onChange={(e)=>setMinVer(e.target.value)} placeholder="e.g., 1.2.3" />
          </div>
          <div>
            <div className="label">Download URL</div>
            <input className="input" value={dlUrl} onChange={(e)=>setDlUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="row" style={{alignItems:'center',gap:8,marginTop:22}}>
            <input type="checkbox" className="toggle" checked={blockBelow} onChange={(e)=>setBlockBelow(e.target.checked)} />
            <span className="label">Block agents below minimum</span>
          </div>
        </div>
      </GlassCard>
    </AppShell>
  )
}
