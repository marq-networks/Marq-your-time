"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import AdjustmentLogTable from '@components/hr/AdjustmentLogTable'
import { normalizeRoleForApi } from '@lib/permissions'
import ExportMenu from '@components/shared/ExportMenu'
import { ExportColumn, exportToCsv, exportToPdf } from '@lib/export-utils'

type Org = { id: string, orgName: string }

export default function MyAdjustmentsPage() {
  const [role, setRole] = useState('')
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  
  // Filters
  const [moduleId, setModuleId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  function getCookie(name: string) {
    if (typeof document === 'undefined') return ''
    return document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(`${name}=`))?.split('=')[1] || ''
  }

  useEffect(() => { 
    // Middleware handles auth redirect.
    try { 
      const r = normalizeRoleForApi(getCookie('current_role'))
      setRole(r) 
    } catch {} 
  }, [])

  const loadOrgs = async () => {
    // For employees, typically 'my' orgs
    const endpoint = '/api/orgs/my'
    try {
      const res = await fetch(endpoint, { cache: 'no-store' })
      if (res.status === 401) { console.error('Failed to load orgs: 401'); return }
      const data = await res.json()
      const items: Org[] = Array.isArray(data.items) ? (data.items as Org[]) : []
      setOrgs(items)
      if (!orgId && items.length) {
        const cookieOrgId = getCookie('current_org_id')
        const preferred = items.find(o => o.id === cookieOrgId)?.id || items[0].id
        setOrgId(preferred)
      }
    } catch (e) { console.error(e) }
  }

  const loadLogs = async () => {
    if (!orgId) return
    setLoading(true)
    let url = `/api/hr-adjustments-log/list?orgId=${orgId}`
    if (moduleId) url += `&module=${moduleId}`
    if (dateFrom) url += `&from=${dateFrom}`
    if (dateTo) url += `&to=${dateTo}`
    
    try {
      const res = await fetch(url, { 
        cache: 'no-store'
      })
      const data = await res.json()
      setLogs(data.items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOrgs() }, [])
  useEffect(() => { if (orgId) { loadLogs(); } }, [orgId])
  useEffect(() => { if (orgId) loadLogs() }, [moduleId, dateFrom, dateTo])

  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      const exportItems = logs
      const exportColumns: ExportColumn[] = [
        { header: 'Date', accessor: (l: any) => new Date(l.created_at).toLocaleDateString() },
        { header: 'Action', accessor: 'action_type' },
        { header: 'Module', accessor: 'module' },
        { header: 'Description', accessor: 'description' },
        { header: 'Status', accessor: 'status' }
      ]
      
      const filename = `marq_my_adjustments_${new Date().toISOString().split('T')[0]}`

      if (type === 'csv') {
        await exportToCsv(exportItems, exportColumns, filename)
      } else {
        await exportToPdf(exportItems, exportColumns, 'My Adjustments', filename)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <AppShell title="My Adjustments">
      <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Adjustment History</h1>
            <p className="text-slate-500 mt-1">Track and audit changes to your records.</p>
          </div>
          <button 
            onClick={() => loadLogs()} 
            disabled={loading || !orgId}
            className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 text-sm font-medium rounded-xl shadow-sm border border-indigo-100 hover:bg-indigo-50 transition-all disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={loading ? "animate-spin" : ""}><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
            Refresh Data
          </button>
        </div>

        {/* Filters Card */}
        <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-3xl p-6 shadow-xl shadow-indigo-100/50">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
             {/* Organization */}
             <div className="md:col-span-3">
               <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 block">Organization</label>
               <div className="relative group">
                 <select 
                    value={orgId} 
                    onChange={(e: any)=>setOrgId(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 rounded-xl bg-white/80 border border-indigo-100 text-sm font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none cursor-pointer hover:border-indigo-300"
                    disabled={orgs.length <= 1}
                 >
                   {orgs.length === 0 && <option value="">Loading organizations...</option>}
                   {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
                 </select>
                 <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-400 group-hover:text-indigo-600 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                 </div>
               </div>
             </div>
             
             {/* Module */}
             <div className="md:col-span-3">
               <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 block">Module</label>
               <div className="relative group">
                 <select 
                    value={moduleId} 
                    onChange={(e: any)=>setModuleId(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 rounded-xl bg-white/80 border border-indigo-100 text-sm font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all appearance-none cursor-pointer hover:border-indigo-300"
                 >
                   <option value="">All Modules</option>
                   <option value="time_logs">Time Logs</option>
                   <option value="breaks">Breaks</option>
                   <option value="attendance">Attendance</option>
                   <option value="pto">PTO</option>
                   <option value="payroll">Payroll</option>
                 </select>
                 <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-400 group-hover:text-indigo-600 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                 </div>
               </div>
             </div>

             {/* Date Range */}
             <div className="md:col-span-4 grid grid-cols-2 gap-3">
                <div>
                   <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 block">From Date</label>
                   <input 
                      type="date" 
                      value={dateFrom} 
                      onChange={(e: any)=>setDateFrom(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/80 border border-indigo-100 text-sm font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all hover:border-indigo-300"
                   />
                </div>
                <div>
                   <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 block">To Date</label>
                   <input 
                      type="date" 
                      value={dateTo} 
                      onChange={(e: any)=>setDateTo(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/80 border border-indigo-100 text-sm font-medium text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all hover:border-indigo-300"
                   />
                </div>
             </div>

             {/* Export - Align right */}
             <div className="md:col-span-2 flex justify-end pb-1">
                <ExportMenu onExport={handleExport} isExporting={isExporting} />
             </div>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-3xl overflow-hidden shadow-2xl shadow-indigo-100/50">
           <AdjustmentLogTable logs={logs} loading={loading} />
        </div>
      </div>
    </AppShell>
  )
}
