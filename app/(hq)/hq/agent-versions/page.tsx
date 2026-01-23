'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import ExportMenu from '@components/shared/ExportMenu'
import { exportToCsv, exportToPdf, type ExportColumn } from '@lib/export-utils'

type Org = { id: string, orgName: string }
type DeviceRow = { device_name: string, org: string, agent_version?: string | null, update_status?: string | null, last_seen?: string | null }

export default function AgentVersionsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [status, setStatus] = useState('')
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [minVer, setMinVer] = useState('')
  const [dlUrl, setDlUrl] = useState('')
  const [dlUrlWin, setDlUrlWin] = useState('')
  const [dlUrlMac, setDlUrlMac] = useState('')
  const [blockBelow, setBlockBelow] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [role, setRole] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const r = document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || ''
    setRole(r.toLowerCase())
  }, [])

  const loadOrgs = async () => { 
    try {
      const res = await fetch('/api/org/list', { cache:'no-store' })
      if (res.ok) {
        const d = await res.json()
        setOrgs(d.items||[]) 
      }
    } catch(e){}
  }

  const loadMin = async (r: string) => { 
    const res = await fetch('/api/hq/agent-version/minimum', { cache:'no-store', headers:{ 'x-role': r }})
    if (res.ok) {
      const d = await res.json()
      setMinVer(d.minimum_version||'')
      setDlUrl(d.download_url||'')
      setDlUrlWin(d.download_url_windows||'')
      setDlUrlMac(d.download_url_mac||'')
      setBlockBelow(!!d.block_below) 
    }
  }

  const loadDevices = async (oid: string, st: string, r: string) => {
    const params = new URLSearchParams()
    if (oid) params.set('org', oid)
    if (st) params.set('status', st)
    const qs = params.toString()
    const res = await fetch(`/api/hq/agent-version/devices${qs?`?${qs}`:''}`, { cache:'no-store', headers:{ 'x-role': r }})
    if (res.ok) {
      const d = await res.json()
      setDevices(d.devices||[])
    }
  }

  useEffect(()=>{ 
    if (role) {
      loadOrgs()
      loadMin(role)
    }
  }, [role])

  useEffect(()=>{ 
    if (role) loadDevices(orgId, status, role) 
  }, [orgId, status, role])

  const saveMin = async () => {
    if (role !== 'super_admin') return
    setIsSaving(true)
    try {
      const res = await fetch('/api/hq/agent-version/minimum', { 
        method:'POST', 
        headers:{ 'Content-Type':'application/json','x-role': role }, 
        body: JSON.stringify({ minimum_version: minVer, download_url: dlUrl, download_url_windows: dlUrlWin, download_url_mac: dlUrlMac, block_below: blockBelow }) 
      })
      if (!res.ok) throw new Error('Failed to save')
      await loadMin(role)
      await loadDevices(orgId, status, role)
      alert('Settings saved successfully!')
    } catch (e) {
      alert('Error saving settings')
    } finally {
      setIsSaving(false)
    }
  }


  const columns = ['Device','Organization','Agent Version','Status','Last Seen']
  const rows = devices.map(d => [ d.device_name, d.org, d.agent_version || '-', <span className="badge">{d.update_status || 'unknown'}</span>, d.last_seen ? new Date(d.last_seen).toLocaleString() : '-' ])

  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      const exportItems = devices
      const exportColumns: ExportColumn[] = [
        { header: 'Device', accessor: 'device_name' },
        { header: 'Organization', accessor: 'org' },
        { header: 'Agent Version', accessor: (d) => d.agent_version || '-' },
        { header: 'Status', accessor: (d) => d.update_status || 'unknown' },
        { header: 'Last Seen', accessor: (d) => d.last_seen ? new Date(d.last_seen).toLocaleString() : '-' }
      ]
      
      const filename = `marq_agent_versions_${new Date().toISOString().split('T')[0]}`

      if (type === 'csv') {
        await exportToCsv(exportItems, exportColumns, filename)
      } else {
        await exportToPdf(exportItems, exportColumns, 'Agent Versions', filename)
      }
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    if (!text) {
      alert('Nothing to copy')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      alert('Copied to clipboard')
    } catch (err) {
      console.error('Failed to copy: ', err)
      // Fallback for insecure context or if clipboard API fails
      try {
        const textArea = document.createElement("textarea")
        textArea.value = text
        textArea.style.position = "fixed"
        textArea.style.left = "-9999px"
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        alert('Copied to clipboard')
      } catch (e) {
        alert('Failed to copy. Please select and copy manually.')
      }
    }
  }

  return (
    <AppShell title="Agent Versions">
      <GlassCard title="Filters">
        <div className="grid grid-3">
          {role === 'super_admin' && (
            <div>
              <div className="label">Organization</div>
              <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
                <option value="">All</option>
                {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
              </GlassSelect>
            </div>
          )}
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

      <GlassCard title="Devices" right={<ExportMenu onExport={handleExport} isExporting={isExporting} />}>
        <GlassTable columns={columns} rows={rows} />
      </GlassCard>

      <GlassCard title="Minimum Agent Version" right={role === 'super_admin' ? <GlassButton variant="primary" disabled={isSaving} onClick={saveMin}>{isSaving ? 'Saving...' : 'Save'}</GlassButton> : null}>
        {role === 'super_admin' && <div style={{marginBottom:16, opacity:0.7, fontSize:'0.9em'}}>Enter the direct download links for your agent installers. These will be sent to agents for auto-updates.</div>}
        <div className="grid grid-3">
          <div>
            <div className="label">Minimum Version</div>
            <input className="input" value={minVer} onChange={(e)=>setMinVer(e.target.value)} placeholder="e.g., 1.2.3" readOnly={role !== 'super_admin'} />
          </div>
          <div>
            <div className="label">Windows URL</div>
            <div style={{display:'flex', gap:4}}>
              <input className="input" value={dlUrlWin} onChange={(e)=>setDlUrlWin(e.target.value)} placeholder={role==='super_admin'?"https://...exe":"Not configured"} readOnly={role !== 'super_admin'} style={{flex:1}} />
              <GlassButton variant="secondary" disabled={!dlUrlWin} onClick={() => copyToClipboard(dlUrlWin)}>Copy</GlassButton>
            </div>
          </div>
          <div>
            <div className="label">Mac URL</div>
            <div style={{display:'flex', gap:4}}>
              <input className="input" value={dlUrlMac} onChange={(e)=>setDlUrlMac(e.target.value)} placeholder={role==='super_admin'?"https://...dmg":"Not configured"} readOnly={role !== 'super_admin'} style={{flex:1}} />
              <GlassButton variant="secondary" disabled={!dlUrlMac} onClick={() => copyToClipboard(dlUrlMac)}>Copy</GlassButton>
            </div>
          </div>
          <div>
            <div className="label">Fallback URL</div>
            <div style={{display:'flex', gap:4}}>
              <input className="input" value={dlUrl} onChange={(e)=>setDlUrl(e.target.value)} placeholder={role==='super_admin'?"https://...":"Not configured"} readOnly={role !== 'super_admin'} style={{flex:1}} />
              <GlassButton variant="secondary" disabled={!dlUrl} onClick={() => copyToClipboard(dlUrl)}>Copy</GlassButton>
            </div>
          </div>
          <div className="row" style={{alignItems:'center',gap:8,marginTop:22}}>
            <input type="checkbox" className="toggle" checked={blockBelow} onChange={(e)=>setBlockBelow(e.target.checked)} disabled={role !== 'super_admin'} />
            <span className="label">Block agents below minimum</span>
          </div>
        </div>
      </GlassCard>
    </AppShell>
  )
}
