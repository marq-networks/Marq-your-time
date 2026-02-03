'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@components/ui/AppShell'
import { useListQuery } from '@/lib/hooks/useListQuery'
import FilterBar from '@/components/filters/FilterBar'
import ExportMenu from '@/components/shared/ExportMenu'
import { exportToCsv, exportToPdf, ExportColumn } from '@/lib/export-utils'
import { 
  Calendar, Clock, CheckCircle, XCircle, AlertCircle, FileText, 
  Search, Filter, ChevronRight, RefreshCw, Wand2, ChevronLeft,
  ArrowRight, User
} from 'lucide-react'

type Org = { id: string, orgName: string }

export default function TimesheetApprovalsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [candidates, setCandidates] = useState<any[]>([])
  const [showCandidates, setShowCandidates] = useState(false)
  const [members, setMembers] = useState<any[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  
  const role = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''
  const userId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_user_id='))?.split('=')[1] || '') : ''
  const currentOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''

  // Use shared hook for URL state
  const { filters, setFilters, search, updateFilter } = useListQuery()
  const page = parseInt(filters.page || '1')
  const pageSize = parseInt(filters.pageSize || '50')

  const loadOrgs = async () => {
    try {
      if (role === 'super_admin') {
        const r = await fetch('/api/org/list', { cache:'no-store', headers:{ 'x-user-id': userId, 'x-role': role } })
        const d = await r.json()
        setOrgs(d.items || [])
        if (d.items && d.items.length > 0 && !orgId) setOrgId(d.items[0].id)
      } else {
        // Load user's organizations
        const r = await fetch('/api/orgs/my', { cache:'no-store', headers:{ 'x-user-id': userId } })
        const d = await r.json()
        setOrgs(d.items || [])
        if (d.items && d.items.length > 0) {
          // Prefer current_org_id if in the list, otherwise first
          const match = d.items.find((o:any) => o.id === currentOrgId)
          setOrgId(match ? match.id : d.items[0].id)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const loadMembers = async (oid: string) => {
    try {
      const r = await fetch(`/api/user/list?orgId=${oid}`)
      const d = await r.json()
      setMembers(d.items || d.users || [])
    } catch (e) { console.error(e) }
  }

  const loadCandidates = async () => {
    if (!orgId) return
    setLoading(true)
    try {
        const r = await fetch(`/api/ai/candidates/list?orgId=${orgId}&status=pending`)
        const d = await r.json()
        setCandidates(d.items || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const loadItems = async () => {
    if (!orgId) { setItems([]); return }
    setLoading(true)
    
    const params = new URLSearchParams()
    params.set('org_id', orgId)
    params.set('page', page.toString())
    params.set('pageSize', pageSize.toString())
    
    if (search) params.set('q', search)
    if (filters.status) params.set('status', filters.status)
    else params.set('status', 'submitted') // Default filter if none

    if (filters.userIds) params.set('userIds', filters.userIds)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    
    // Anomaly Filters
    if (filters.idle_gt) params.set('idle_gt', filters.idle_gt)
    if (filters.missing_screenshots) params.set('missing_screenshots', filters.missing_screenshots)
    if (filters.overtime_gt) params.set('overtime_gt', filters.overtime_gt)

    if (filters.sort) params.set('sort', filters.sort)

    try {
      const r = await fetch(`/api/timesheets/list?${params.toString()}`, { cache:'no-store', headers:{ 'x-role': role || 'admin', 'x-user-id': userId } })
      const d = await r.json()
      setItems(d.items || [])
      setTotalItems(d.total || 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId) loadMembers(orgId) }, [orgId])
  useEffect(()=>{ 
    if (showCandidates) loadCandidates()
    else loadItems() 
  }, [orgId, filters, search, page, pageSize, showCandidates])

  const handleExport = async (type: 'csv' | 'pdf') => {
    if (!orgId) return
    setIsExporting(true)
    try {
      const params = new URLSearchParams()
      params.set('org_id', orgId)
      params.set('page', '1')
      params.set('pageSize', '10000')
      
      if (search) params.set('q', search)
      if (filters.status) params.set('status', filters.status)
      else params.set('status', 'submitted')

      if (filters.userIds) params.set('userIds', filters.userIds)
      if (filters.from) params.set('from', filters.from)
      if (filters.to) params.set('to', filters.to)
      if (filters.idle_gt) params.set('idle_gt', filters.idle_gt)
      if (filters.missing_screenshots) params.set('missing_screenshots', filters.missing_screenshots)
      if (filters.overtime_gt) params.set('overtime_gt', filters.overtime_gt)
      if (filters.sort) params.set('sort', filters.sort)

      const r = await fetch(`/api/timesheets/list?${params.toString()}`, { cache:'no-store', headers:{ 'x-role': role || 'admin', 'x-user-id': userId } })
      const d = await r.json()
      const exportItems = d.items || []

      const exportColumns: ExportColumn[] = [
        { header: 'Employee', accessor: (it) => `${it.employees?.first_name || ''} ${it.employees?.last_name || ''}`.trim() },
        { header: 'Period', accessor: (it) => `${it.period_start} - ${it.period_end}` },
        { header: 'Status', accessor: (it) => it.status.toUpperCase() },
        { header: 'Total Worked', accessor: (it) => `${Math.round(it.totals?.worked_minutes / 60 || 0)}h ${Math.round((it.totals?.worked_minutes || 0) % 60)}m` },
      ]

      const filename = `marq_timesheets_${new Date().toISOString().split('T')[0]}`
      if (type === 'csv') exportToCsv(exportItems, exportColumns, filename)
      else exportToPdf(exportItems, exportColumns, 'Timesheet Approvals', filename)
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const filterConfig = useMemo(() => [
    {
      key: 'status',
      label: 'Status',
      type: 'status' as const,
      options: [
        { label: 'Submitted', value: 'submitted' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
        { label: 'Changes Required', value: 'changes_required' },
        { label: 'Draft', value: 'draft' }
      ]
    },
    {
      key: 'userIds',
      label: 'Employees',
      type: 'multi-select' as const,
      options: members.map(m => ({ label: `${m.firstName} ${m.lastName}`, value: m.id }))
    },
    {
      key: 'date',
      label: 'Period',
      type: 'date-range' as const
    },
    {
      key: 'idle_gt',
      label: 'Idle > X min',
      type: 'select' as const,
      options: [
        { label: 'Any', value: '' },
        { label: '> 30 mins', value: '30' },
        { label: '> 1 hour', value: '60' },
        { label: '> 2 hours', value: '120' },
        { label: '> 4 hours', value: '240' }
      ]
    },
    {
      key: 'missing_screenshots',
      label: 'Missing Screenshots',
      type: 'select' as const,
      options: [
        { label: 'All', value: '' },
        { label: 'Yes (Anomalies)', value: 'true' }
      ]
    },
    {
      key: 'overtime_gt',
      label: 'Overtime > X min',
      type: 'select' as const,
      options: [
        { label: 'Any', value: '' },
        { label: '> 30 mins', value: '30' },
        { label: '> 1 hour', value: '60' },
        { label: '> 2 hours', value: '120' }
      ]
    },
    {
      key: 'sort',
      label: 'Sort By',
      type: 'sort' as const,
      options: [
        { label: 'Period (Newest)', value: 'period_start:desc' },
        { label: 'Period (Oldest)', value: 'period_start:asc' }
      ]
    }
  ], [members])

  const getMemberInitials = (firstName: string = '', lastName: string = '') => {
    return (firstName[0] || '') + (lastName[0] || '')
  }

  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
      case 'approved': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'rejected': return 'bg-rose-100 text-rose-700 border-rose-200'
      case 'submitted': return 'bg-indigo-100 text-indigo-700 border-indigo-200'
      case 'draft': return 'bg-slate-100 text-slate-700 border-slate-200'
      case 'changes_required': return 'bg-amber-100 text-amber-700 border-amber-200'
      default: return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  return (
    <AppShell title="Timesheet Approvals">
      <div className="flex flex-col gap-8 max-w-[1600px] mx-auto pb-10">
        
        {/* Controls */}
        <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-3xl p-6 shadow-xl shadow-indigo-100/50 flex flex-col md:flex-row gap-6 justify-between items-center">
          <div className="flex items-center gap-4 w-full md:w-auto flex-1">
             <div className="relative w-72 max-w-full">
               <select 
                 className="w-full pl-10 pr-4 py-3 bg-white/80 border border-indigo-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm font-medium text-slate-700 appearance-none transition-all hover:border-indigo-300"
                 value={orgId} 
                 onChange={(e)=> setOrgId(e.target.value)}
               >
                 <option value="">Select Organization</option>
                 {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
               </select>
               <div className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none">
                 <Filter size={18} />
               </div>
               <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                 <ChevronRight size={16} className="rotate-90" />
               </div>
             </div>

             {/* Tab Switcher */}
             <div className="flex bg-indigo-50/50 p-1.5 rounded-xl border border-indigo-100/50">
                <button 
                    className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${!showCandidates ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-indigo-500 hover:bg-white/50'}`}
                    onClick={()=>setShowCandidates(false)}
                >
                    <FileText size={16} />
                    Timesheets
                </button>
                <button 
                    className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${showCandidates ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-indigo-500 hover:bg-white/50'}`}
                    onClick={()=>setShowCandidates(true)}
                >
                    <Wand2 size={16} />
                    AI Corrections
                    {candidates.length > 0 && (
                        <span className="bg-indigo-100 text-indigo-600 text-xs px-1.5 py-0.5 rounded-full ml-1">
                            {candidates.length}
                        </span>
                    )}
                </button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <button 
               onClick={() => { showCandidates ? loadCandidates() : loadItems() }} 
               disabled={loading || !orgId}
               className="p-3 bg-white/80 border border-indigo-100 rounded-xl text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all disabled:opacity-50"
               title="Refresh Data"
             >
               <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
             </button>
             <ExportMenu onExport={handleExport} isExporting={isExporting} />
          </div>
        </div>

        {!showCandidates && (
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start">
                <div className="flex-1 w-full">
                    <FilterBar 
                        pageKey="timesheets_approvals" 
                        orgId={orgId} 
                        config={filterConfig} 
                        showSavedViews
                    />
                </div>
            </div>
        )}

        {/* Content Section */}
        <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-3xl overflow-hidden shadow-2xl shadow-indigo-100/50 min-h-[300px]">
            {/* Header */}
            <div className="px-8 py-6 border-b border-indigo-100/50 bg-white/30 flex items-center gap-3">
                <div className={`p-2 rounded-xl ${showCandidates ? 'bg-purple-100 text-purple-600' : 'bg-indigo-100 text-indigo-600'}`}>
                    {showCandidates ? <Wand2 size={24} /> : <Clock size={24} />}
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-800">
                        {showCandidates ? "Pending AI Suggestions" : "Timesheet Requests"}
                    </h2>
                    <p className="text-sm text-slate-500">
                        {showCandidates ? "Review anomalies and corrections detected by AI" : "Review and approve employee timesheets"}
                    </p>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-indigo-100/50 bg-indigo-50/30">
                            {showCandidates ? (
                                <>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-indigo-400 uppercase tracking-wider first:pl-8">Date Detected</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-indigo-400 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-indigo-400 uppercase tracking-wider">Reason</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-indigo-400 uppercase tracking-wider">Confidence</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-indigo-400 uppercase tracking-wider last:pr-8">Actions</th>
                                </>
                            ) : (
                                <>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-indigo-400 uppercase tracking-wider first:pl-8">Employee</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-indigo-400 uppercase tracking-wider">Period</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-indigo-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-indigo-400 uppercase tracking-wider">Total Worked</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-indigo-400 uppercase tracking-wider last:pr-8">Actions</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-50">
                        {loading ? (
                             <tr><td colSpan={5} className="px-6 py-20 text-center text-slate-400">Loading data...</td></tr>
                        ) : (showCandidates ? candidates : items).length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-20 text-center text-slate-400">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-2 ring-4 ring-slate-50/50">
                                            <CheckCircle size={32} className="text-emerald-300" />
                                        </div>
                                        <span className="font-medium text-slate-600">All caught up!</span>
                                        <span className="text-sm">No {showCandidates ? 'AI corrections' : 'timesheets'} found.</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            (showCandidates ? candidates : items).map((item: any) => (
                                showCandidates ? (
                                    <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap first:pl-8 text-sm text-slate-600">
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-50 text-purple-600 border border-purple-100">
                                                {item.candidate_type.replace('_', ' ').toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate">
                                            {item.reason}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${item.confidence * 100}%` }}></div>
                                                </div>
                                                <span className="text-xs font-bold text-slate-700">{Math.round(item.confidence * 100)}%</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right last:pr-8">
                                            <button 
                                                onClick={()=>router.push(`/timesheets/approvals/${item.timesheets?.id || ''}`)}
                                                className="px-4 py-2 rounded-xl bg-white border border-indigo-100 text-indigo-600 text-sm font-medium shadow-sm hover:bg-indigo-50 hover:border-indigo-200 transition-all"
                                            >
                                                View Details
                                            </button>
                                        </td>
                                    </tr>
                                ) : (
                                    <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap first:pl-8">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600 flex items-center justify-center text-xs font-bold border border-white shadow-sm">
                                                    {getMemberInitials(item.employees?.first_name, item.employees?.last_name)}
                                                </div>
                                                <div className="font-semibold text-indigo-900">
                                                    {item.employees?.first_name} {item.employees?.last_name}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-indigo-300" />
                                                <span>{item.period_start}</span>
                                                <span className="text-slate-300">→</span>
                                                <span>{item.period_end}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${getStatusColor(item.status)}`}>
                                                {item.status.toUpperCase().replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                                <Clock size={14} className="text-slate-400" />
                                                {Math.round(item.totals?.worked_minutes / 60 || 0)}h {Math.round((item.totals?.worked_minutes || 0) % 60)}m
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right last:pr-8">
                                            <button 
                                                onClick={()=>router.push(`/timesheets/approvals/${item.id}`)}
                                                className="px-4 py-2 rounded-xl bg-white border border-indigo-100 text-indigo-600 text-sm font-medium shadow-sm hover:bg-indigo-50 hover:border-indigo-200 transition-all group-hover:shadow-md group-hover:border-indigo-300 flex items-center gap-2 ml-auto"
                                            >
                                                Review
                                                <ArrowRight size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer / Pagination */}
            {!showCandidates && items.length > 0 && (
                <div className="px-8 py-4 border-t border-indigo-50 bg-white/30 flex items-center justify-between">
                    <div className="text-sm text-slate-500">
                        Showing <span className="font-semibold text-slate-700">{items.length}</span> of <span className="font-semibold text-slate-700">{totalItems}</span> results
                    </div>
                    <div className="flex gap-2">
                        <button 
                            disabled={page <= 1}
                            onClick={() => updateFilter('page', String(page - 1))}
                            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button 
                            disabled={page * pageSize >= totalItems}
                            onClick={() => updateFilter('page', String(page + 1))}
                            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </AppShell>
  )
}
