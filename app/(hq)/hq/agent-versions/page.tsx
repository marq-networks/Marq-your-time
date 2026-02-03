'use client'
import { useEffect, useState, useMemo } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import GlassInput from '@components/ui/GlassInput'
import ExportMenu from '@components/shared/ExportMenu'
import { exportToCsv, exportToPdf, type ExportColumn } from '@lib/export-utils'
import { Monitor, Building2, Shield, Download, Save, Filter, CheckCircle, AlertCircle, XCircle, Copy, Clock, Search, Activity, Zap } from 'lucide-react'

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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const r = document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || ''
    setRole(r.toLowerCase())
    if (!r) setLoading(false)
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
    setLoading(true)
    const params = new URLSearchParams()
    if (oid) params.set('org', oid)
    if (st) params.set('status', st)
    const qs = params.toString()
    try {
      const res = await fetch(`/api/hq/agent-version/devices${qs?`?${qs}`:''}`, { cache:'no-store', headers:{ 'x-role': r }})
      if (res.ok) {
        const d = await res.json()
        setDevices(d.devices||[])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
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

  const stats = useMemo(() => {
    const total = devices.length
    const outdated = devices.filter(d => d.update_status === 'outdated').length
    const blocked = devices.filter(d => d.update_status === 'blocked').length
    const online = devices.filter(d => {
       if (!d.last_seen) return false
       const diff = Date.now() - new Date(d.last_seen).getTime()
       return diff < 1000 * 60 * 60 // 1 hour
    }).length
    return { total, outdated, blocked, online }
  }, [devices])


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
  const rows = devices.map(d => [
    <div key="device" className="flex flex-col">
      <span className="font-medium text-slate-700">{d.device_name}</span>
    </div>,
    <span key="org" className="text-sm text-slate-600">{d.org}</span>,
    <span key="ver" className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">{d.agent_version || '-'}</span>,
    <span key="status" className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${
      d.update_status === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 
      d.update_status === 'blocked' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
      d.update_status === 'outdated' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
      'bg-slate-100 text-slate-600 border border-slate-200'
    }`}>
      {d.update_status === 'ok' ? <CheckCircle size={12} /> : 
       d.update_status === 'blocked' ? <XCircle size={12} /> : 
       d.update_status === 'outdated' ? <AlertCircle size={12} /> : null}
      <span className="capitalize">{d.update_status || 'unknown'}</span>
    </span>,
    <span key="seen" className="text-sm text-slate-500 flex items-center gap-1">
      <Clock size={12} />
      {d.last_seen ? new Date(d.last_seen).toLocaleString() : '-'}
    </span>
  ])

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
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 border border-indigo-100">
              <Monitor size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Agent Versions</h1>
              <p className="text-slate-500 text-sm">Monitor and manage desktop agent deployments across organizations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GlassButton onClick={() => loadDevices(orgId, status, role)} variant="secondary" className="flex items-center gap-2">
              <Activity size={16} />
              Refresh
            </GlassButton>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <GlassCard className="!p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Monitor size={24} />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Total Agents</div>
              <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
            </div>
          </GlassCard>
          <GlassCard className="!p-4 flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <Zap size={24} />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Online (1h)</div>
              <div className="text-2xl font-bold text-slate-800">{stats.online}</div>
            </div>
          </GlassCard>
           <GlassCard className="!p-4 flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <AlertCircle size={24} />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Outdated</div>
              <div className="text-2xl font-bold text-slate-800">{stats.outdated}</div>
            </div>
          </GlassCard>
           <GlassCard className="!p-4 flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <XCircle size={24} />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500">Blocked</div>
              <div className="text-2xl font-bold text-slate-800">{stats.blocked}</div>
            </div>
          </GlassCard>
        </div>
        
        {/* Filters */}
        <GlassCard 
          title={
            <div className="flex items-center gap-2">
              <Filter size={20} className="text-indigo-600" />
              <span>Filters</span>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {role === 'super_admin' && (
              <div>
                <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Organization</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                  <GlassSelect 
                    value={orgId} 
                    onChange={(e:any)=>setOrgId(e.target.value)}
                    className="pl-10"
                  >
                    <option value="">All Organizations</option>
                    {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
                  </GlassSelect>
                </div>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Status</label>
              <GlassSelect value={status} onChange={(e:any)=>setStatus(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="ok">OK</option>
                <option value="outdated">Outdated</option>
                <option value="blocked">Blocked</option>
              </GlassSelect>
            </div>
          </div>
        </GlassCard>

        {/* Devices Table */}
        <GlassCard 
          title={
            <div className="flex items-center gap-2">
              <Monitor size={20} className="text-emerald-600" />
              <span>Devices</span>
            </div>
          }
          right={<ExportMenu onExport={handleExport} isExporting={isExporting} />}
          className="relative overflow-hidden"
        >
          <Monitor size={120} className="text-emerald-900/5 absolute -bottom-4 -right-4 pointer-events-none z-0" />
          <div className="relative z-10">
            {loading ? (
               <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                <p className="text-sm">Loading devices...</p>
              </div>
            ) : devices.length > 0 ? (
              <GlassTable columns={columns} rows={rows} />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Monitor size={32} className="text-slate-300" />
                </div>
                <p className="text-base font-medium text-slate-600">No devices found</p>
                <p className="text-sm mt-1">Try adjusting your filters to find what you're looking for.</p>
              </div>
            )}
          </div>

        </GlassCard>

        {/* Configuration */}
        <GlassCard 
          title={
            <div className="flex items-center gap-2">
              <Shield size={20} className="text-indigo-600" />
              <span>Agent Configuration</span>
            </div>
          }
          right={role === 'super_admin' ? (
            <GlassButton variant="primary" disabled={isSaving} onClick={saveMin} className="bg-indigo-600 text-white hover:bg-indigo-700 border-none">
              {isSaving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : <Save size={16} className="mr-2" />}
              {isSaving ? 'Saving...' : 'Save Changes'}
            </GlassButton>
          ) : null}
        >
          {role === 'super_admin' && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-6 flex items-start gap-3">
              <Download className="text-indigo-600 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-medium text-indigo-900">Download Links Configuration</p>
                <p className="text-xs text-indigo-700 mt-1">
                  Enter direct download links for your agent installers. These URLs will be sent to agents for auto-updates when their version is below the minimum.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Minimum Allowed Version</label>
              <GlassInput 
                value={minVer} 
                onChange={(e: any)=>setMinVer(e.target.value)} 
                placeholder="e.g., 1.2.3" 
                readOnly={role !== 'super_admin'}
                className="max-w-xs font-mono"
              />
            </div>

            <div className="space-y-4">
               {/* Windows URL */}
               <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Windows Installer URL</label>
                  <div className="flex gap-2">
                    <GlassInput 
                      value={dlUrlWin} 
                      onChange={(e: any)=>setDlUrlWin(e.target.value)} 
                      placeholder={role==='super_admin'?"https://...exe":"Not configured"} 
                      readOnly={role !== 'super_admin'} 
                      className="flex-1 font-mono text-xs"
                    />
                    <GlassButton variant="secondary" disabled={!dlUrlWin} onClick={() => copyToClipboard(dlUrlWin)} title="Copy URL">
                      <Copy size={16} />
                    </GlassButton>
                  </div>
               </div>
               {/* Mac URL */}
               <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1.5 block">macOS Installer URL</label>
                  <div className="flex gap-2">
                    <GlassInput 
                      value={dlUrlMac} 
                      onChange={(e: any)=>setDlUrlMac(e.target.value)} 
                      placeholder={role==='super_admin'?"https://...dmg":"Not configured"} 
                      readOnly={role !== 'super_admin'} 
                      className="flex-1 font-mono text-xs"
                    />
                    <GlassButton variant="secondary" disabled={!dlUrlMac} onClick={() => copyToClipboard(dlUrlMac)} title="Copy URL">
                      <Copy size={16} />
                    </GlassButton>
                  </div>
               </div>
            </div>

            <div className="space-y-4">
              {/* Fallback URL */}
               <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Fallback / Linux URL</label>
                  <div className="flex gap-2">
                    <GlassInput 
                      value={dlUrl} 
                      onChange={(e: any)=>setDlUrl(e.target.value)} 
                      placeholder={role==='super_admin'?"https://...":"Not configured"} 
                      readOnly={role !== 'super_admin'} 
                      className="flex-1 font-mono text-xs"
                    />
                    <GlassButton variant="secondary" disabled={!dlUrl} onClick={() => copyToClipboard(dlUrl)} title="Copy URL">
                      <Copy size={16} />
                    </GlassButton>
                  </div>
               </div>

               {/* Block Toggle */}
               <div className="pt-6">
                 <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                      checked={blockBelow} 
                      onChange={(e)=>setBlockBelow(e.target.checked)} 
                      disabled={role !== 'super_admin'} 
                    />
                    <span className="text-sm font-medium text-slate-700">Block agents below minimum version</span>
                 </label>
               </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  )
}
