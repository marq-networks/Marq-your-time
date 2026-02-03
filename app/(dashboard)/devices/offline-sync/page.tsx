'use client'
import { useEffect, useMemo, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'
import GlassTable from '@components/ui/GlassTable'
import GlassModal from '@components/ui/GlassModal'
import ExportMenu from '@/components/shared/ExportMenu'
import { exportToCsv, exportToPdf, ExportColumn } from '@/lib/export-utils'
import { 
  WifiOff, 
  Wifi, 
  Smartphone, 
  Database, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Search, 
  RefreshCw,
  FileJson,
  Calendar,
  Layers,
  Server
} from 'lucide-react'

type Org = { id: string, orgName: string }
type Batch = { local_batch_id: string, batch_type: string, status: string, item_count: number, received_at: string, processed_at: string|null, error_message: string|null }
type Conflict = { id: string, conflict_type: string, created_at: string, device_id: string, member_id: string, org_id: string }

export default function OfflineSyncPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [limit, setLimit] = useState(50)
  const [batches, setBatches] = useState<Batch[]>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [openQueueId, setOpenQueueId] = useState<string|null>(null)
  const [items, setItems] = useState<{ item_index: number, payload_type: string, payload: any }[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [batchSearch, setBatchSearch] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/org/list')
        const j = await res.json()
        const list = j.items || j.orgs || []
        setOrgs(list)
        
        // Auto-select logic
        let selectedId = ''
        const cookieOrg = document.cookie.match(/current_org_id=([^;]+)/)?.[1]
        
        if (list.length > 0) {
          if (cookieOrg && list.find((o:any) => o.id === cookieOrg)) {
            selectedId = cookieOrg
          } else {
            selectedId = list[0].id
          }
          setOrgId(selectedId)
        } else if (cookieOrg) {
          // Fallback if list is empty but cookie exists
          setOrgs([{ id: cookieOrg, orgName: 'Current Org' }])
          setOrgId(cookieOrg)
        }
      } catch (e) {
        console.error(e)
      }
    })()
  }, [])

  const loadStatus = async () => {
    if (!orgId) return
    const params = new URLSearchParams()
    params.set('org_id', orgId)
    if (deviceId) params.set('device_id', deviceId)
    params.set('limit', String(limit))
    const res = await fetch(`/api/agent/offline/status?${params.toString()}`)
    const j = await res.json()
    setBatches(j.batches || [])
    setConflicts(j.conflicts || [])
  }

  useEffect(() => { if (orgId) loadStatus() }, [orgId, deviceId, limit])

  const deviceOptions = useMemo(() => {
    const ids = Array.from(new Set((batches || []).map(b => (b as any).device_id).filter(Boolean)))
    return ids.map(id => ({ id, label: id }))
  }, [batches])

  const filteredBatches = useMemo(() => {
    const s = rangeStart ? new Date(rangeStart + 'T00:00:00').getTime() : 0
    const e = rangeEnd ? new Date(rangeEnd + 'T23:59:59').getTime() : Number.MAX_SAFE_INTEGER
    const q = batchSearch.trim().toLowerCase()
    return batches.filter(b => {
      const t = new Date(b.received_at).getTime()
      if (rangeStart || rangeEnd) {
        if (t < s || t > e) return false
      }
      if (statusFilter && b.status !== statusFilter) return false
      if (!q) return true
      const text = `${b.local_batch_id||''} ${(b as any).device_id||''} ${b.batch_type||''} ${b.status||''}`.toLowerCase()
      return text.includes(q)
    })
  }, [batches, rangeStart, rangeEnd, statusFilter, batchSearch])

  const stats = useMemo(() => {
    const total = filteredBatches.length
    const pending = filteredBatches.filter(b => b.status === 'pending').length
    const applied = filteredBatches.filter(b => b.status === 'applied').length
    const error = filteredBatches.filter(b => b.status === 'error').length
    const conflictCount = conflicts.length
    return { total, pending, applied, error, conflictCount }
  }, [filteredBatches, conflicts])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'applied': return <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1 w-fit"><CheckCircle size={12} /> Applied</span>
      case 'pending': return <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold flex items-center gap-1 w-fit"><Clock size={12} /> Pending</span>
      case 'error': return <span className="px-2 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1 w-fit"><AlertTriangle size={12} /> Error</span>
      default: return <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center gap-1 w-fit">{status}</span>
    }
  }

  const batchCols = ['Local Batch ID','Type','Items','Status','Received','Processed','Error','Actions']

  const conflictCols = ['Type','Device','Member','Created At','Actions']

  const openItems = async (queueId: string) => {
    const res = await fetch(`/api/agent/offline/items?sync_queue_id=${encodeURIComponent(queueId)}`)
    const j = await res.json()
    setItems(j.items || [])
    setOpenQueueId(queueId)
  }

  const handleExport = async (type: 'csv' | 'pdf') => {
    if (!orgId) return
    setIsExporting(true)
    try {
      const exportItems = filteredBatches
      const exportColumns: ExportColumn[] = [
        { header: 'Local Batch ID', accessor: 'local_batch_id' },
        { header: 'Type', accessor: 'batch_type' },
        { header: 'Items', accessor: (b) => String(b.item_count) },
        { header: 'Status', accessor: 'status' },
        { header: 'Received At', accessor: 'received_at' },
        { header: 'Processed At', accessor: (b) => b.processed_at || '-' },
        { header: 'Error', accessor: (b) => b.error_message || '-' },
      ]

      const filename = `marq_offline_batches_${new Date().toISOString().split('T')[0]}`
      if (type === 'csv') exportToCsv(exportItems, exportColumns, filename)
      else exportToPdf(exportItems, exportColumns, 'Offline Sync Batches', filename)
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <AppShell title="Offline Sync Management">
      <div className="space-y-6 max-w-7xl mx-auto p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <GlassCard className="flex flex-col gap-1 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-3 opacity-10"><Layers size={48} className="text-slate-600"/></div>
             <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Batches</div>
             <div className="text-2xl font-bold text-slate-700">{stats.total}</div>
          </GlassCard>
          <GlassCard className="flex flex-col gap-1 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-3 opacity-10"><Clock size={48} className="text-amber-600"/></div>
             <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending</div>
             <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
          </GlassCard>
          <GlassCard className="flex flex-col gap-1 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-3 opacity-10"><CheckCircle size={48} className="text-emerald-600"/></div>
             <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Applied</div>
             <div className="text-2xl font-bold text-emerald-600">{stats.applied}</div>
          </GlassCard>
          <GlassCard className="flex flex-col gap-1 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-3 opacity-10"><AlertTriangle size={48} className="text-rose-600"/></div>
             <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Errors</div>
             <div className="text-2xl font-bold text-rose-600">{stats.error}</div>
          </GlassCard>
          <GlassCard className="flex flex-col gap-1 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-3 opacity-10"><WifiOff size={48} className="text-indigo-600"/></div>
             <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Conflicts</div>
             <div className="text-2xl font-bold text-indigo-600">{stats.conflictCount}</div>
          </GlassCard>
        </div>

        <GlassCard className="relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
             <WifiOff size={120} className="text-slate-500" />
          </div>
          <div className="relative z-10">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <WifiOff className="text-slate-600" size={24} />
                  Sync Operations
                </h2>
                <p className="text-slate-500 text-sm mt-1">Monitor offline data synchronization from devices</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                 <GlassButton 
                   onClick={loadStatus} 
                   className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 flex items-center gap-2"
                 >
                   <RefreshCw size={16} /> Refresh
                 </GlassButton>
                 <ExportMenu onExport={handleExport} isExporting={isExporting} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Organization</label>
                <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)} className="w-full">
                  <option value="">Select org</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.orgName}</option>)}
                </GlassSelect>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Device</label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-2.5 text-slate-400" size={16} />
                  <GlassSelect value={deviceId} onChange={(e:any)=>setDeviceId(e.target.value)} className="w-full pl-10">
                    <option value="">All devices</option>
                    {deviceOptions.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </GlassSelect>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date Range</label>
                <div className="flex items-center gap-2">
                  <input type="date" value={rangeStart} onChange={(e)=>setRangeStart(e.target.value)} className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-sm" />
                  <span className="text-slate-400">-</span>
                  <input type="date" value={rangeEnd} onChange={(e)=>setRangeEnd(e.target.value)} className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</label>
                <GlassSelect value={statusFilter} onChange={(e:any)=>setStatusFilter(e.target.value)} className="w-full">
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="applied">Applied</option>
                  <option value="error">Error</option>
                </GlassSelect>
              </div>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                <input 
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                  placeholder="Search batches by ID, device, type..." 
                  value={batchSearch} 
                  onChange={e=>setBatchSearch(e.target.value)} 
                />
              </div>

              {filteredBatches.length > 0 ? (
                <GlassTable columns={batchCols} rows={filteredBatches.map(b => [
                  <span className="font-mono text-xs text-slate-600">{b.local_batch_id}</span>,
                  <span className="text-sm font-medium">{b.batch_type}</span>,
                  String(b.item_count),
                  getStatusBadge(b.status),
                  <span className="text-xs text-slate-500">{b.received_at}</span>,
                  <span className="text-xs text-slate-500">{b.processed_at || '-'}</span>,
                  b.error_message ? <span className="text-xs text-rose-600 font-medium truncate max-w-[150px] inline-block" title={b.error_message}>{b.error_message}</span> : '-',
                  <GlassButton key={`open-${b.local_batch_id}`} onClick={()=>openItems((b as any).id)} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-100 text-xs py-1 px-3 h-auto">
                    View
                  </GlassButton>
                ])} />
              ) : (
                 <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
                   <Server size={48} className="text-slate-300 mb-4" />
                   <h3 className="text-lg font-medium text-slate-700">No sync batches found</h3>
                   <p className="text-slate-500 text-sm mt-1">No offline data has been synced matching your criteria.</p>
                 </div>
              )}
            </div>
          </div>
          </div>
        </GlassCard>

        {conflicts.length > 0 && (
          <GlassCard title="Conflicts" className="relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <AlertTriangle size={120} className="text-amber-500" />
             </div>
             <div className="relative z-10">
            <GlassTable columns={conflictCols} rows={conflicts.map(c => [
              c.conflict_type,
              c.device_id,
              c.member_id,
              c.created_at,
              <GlassButton key={`resolve-${c.id}`} onClick={async()=>{ await fetch('/api/agent/offline/conflicts/resolve', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ conflict_id: c.id, resolution_note: 'Resolved by admin' }) }); loadStatus() }} className="bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-100">Mark Resolved</GlassButton>
            ])} />
            </div>
          </GlassCard>
        )}

        <GlassModal open={!!openQueueId} title={`Batch Details`} onClose={()=>setOpenQueueId(null)}>
          <div className="flex flex-col h-[500px]">
             <div className="flex items-center gap-2 p-3 bg-slate-50 border-b border-slate-100">
                <FileJson size={16} className="text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Batch ID: {openQueueId}</span>
             </div>
             <div className="flex-1 overflow-auto p-4 bg-slate-900 text-slate-300 font-mono text-xs rounded-b-lg">
               <pre>{JSON.stringify(items, null, 2)}</pre>
             </div>
          </div>
        </GlassModal>
      </div>
    </AppShell>
  )
}
