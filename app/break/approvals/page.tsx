'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import { normalizeRoleForApi } from '@lib/permissions'
import ExportMenu from '@/components/shared/ExportMenu'
import { exportToCsv, exportToPdf, ExportColumn } from '@/lib/export-utils'
import { 
  CheckCircle, Clock, XCircle, AlertCircle, Calendar, 
  ChevronRight, Filter, Download, Search, User, Coffee
} from 'lucide-react'

type Org = { id: string, orgName: string }

export default function BreakApprovalsPage() {
  const [forbidden, setForbidden] = useState(false)
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [open, setOpen] = useState<{ id?: string, action?: 'approved'|'rejected' } | null>(null)
  const [note, setNote] = useState('')
  const [role, setRole] = useState('')
  const [actorId, setActorId] = useState('')
  const [history, setHistory] = useState<any[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const handleExport = async (type: 'csv' | 'pdf') => {
    if (!orgId) return
    setIsExporting(true)
    try {
      const allItems = [
        ...items.map(i => ({ ...i, status: 'pending' })),
        ...history
      ]
      const exportColumns: ExportColumn[] = [
        { header: 'Member', accessor: (i) => getMemberName(i) },
        { header: 'Break Session', accessor: 'break_session_id' },
        { header: 'Requested At', accessor: (i) => i.created_at ? new Date(i.created_at).toLocaleString() : '-' },
        { header: 'Reason', accessor: 'reason' },
        { header: 'Status', accessor: 'status' },
        { header: 'Reviewed At', accessor: (i) => i.reviewed_at ? new Date(i.reviewed_at).toLocaleString() : '-' },
        { header: 'Note', accessor: 'review_note' },
      ]
      const filename = `marq_break_approvals_${new Date().toISOString().split('T')[0]}`
      if (type === 'csv') exportToCsv(allItems, exportColumns, filename)
      else exportToPdf(allItems, exportColumns, 'Break Approvals', filename)
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const loadOrgs = async () => {
    const endpoint = role === 'super_admin' ? '/api/org/list' : '/api/orgs/my'
    const res = await fetch(endpoint, { cache:'no-store' })
    const d = await res.json()
    const items: Org[] = Array.isArray(d.items) ? (d.items as Org[]) : []
    setOrgs(items)
    if (!orgId && items.length) {
      const cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
      const preferred = items.find(o => o.id === cookieOrgId)?.id || items[0].id
      setOrgId(preferred)
    } else if (!orgId && items.length === 0) {
      setLoading(false)
    }
  }

  const buildHeaders = () => {
    const hdr: Record<string,string> = {}
    const r = role.toLowerCase()
    if (r === 'manager') {
      if (actorId) { hdr['x-role'] = 'manager'; hdr['x-user-id'] = actorId }
    } else if (['admin','owner','super_admin','org_admin','hr'].includes(r)) {
      hdr['x-role'] = 'org_admin'
      if (actorId) hdr['x-user-id'] = actorId
    }
    return hdr
  }

  const loadData = async () => {
    if (!orgId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const headers = buildHeaders()
    
    try {
      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        fetch(`/api/time/break/approvals?org_id=${orgId}&status=pending`, { cache:'no-store', headers }),
        fetch(`/api/time/break/approvals?org_id=${orgId}&status=approved`, { cache:'no-store', headers }),
        fetch(`/api/time/break/approvals?org_id=${orgId}&status=rejected`, { cache:'no-store', headers })
      ])

      if (pendingRes.status === 403) {
        setForbidden(true)
        setLoading(false)
        return
      }

      const pendingData = await pendingRes.json()
      const approvedData = await approvedRes.json().catch(()=>({items:[]}))
      const rejectedData = await rejectedRes.json().catch(()=>({items:[]}))

      setItems(pendingData.items || [])
      
      const hist = ([] as any[]).concat(approvedData.items||[], rejectedData.items||[])
        .sort((x:any,y:any)=> new Date(y.reviewed_at||y.created_at||0).getTime() - new Date(x.reviewed_at||x.created_at||0).getTime())
        .slice(0,50)
      
      setHistory(hist)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const review = async () => {
    if (!open?.id || !open?.action) return
    const headers: Record<string,string> = { 'Content-Type':'application/json' }
    const r = role.toLowerCase()
    if (r === 'manager') {
      headers['x-role'] = 'manager'
      if (actorId) headers['x-user-id'] = actorId
    } else if (['admin','owner','super_admin','org_admin','hr'].includes(r)) {
      headers['x-role'] = 'org_admin'
      if (actorId) headers['x-user-id'] = actorId
    }
    const res = await fetch('/api/time/break/approval/review', { method:'POST', headers, body: JSON.stringify({ approval_id: open.id, status: open.action, note }) })
    if (res.status === 403) { setForbidden(true); return }
    setOpen(null)
    setNote('')
    loadData()
  }

  useEffect(() => {
    try {
      const r = normalizeRoleForApi((typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''))
      setRole(r)
      const uid = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_user_id='))?.split('=')[1] || '') : ''
      setActorId(uid)
    } catch {}
  }, [])

  useEffect(() => { loadOrgs() }, [role])
  useEffect(() => { loadData() }, [orgId])

  if (forbidden) {
    return (
      <AppShell title="Break Approvals">
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <div className="bg-white/60 backdrop-blur-xl p-8 rounded-3xl border border-white/40 shadow-xl text-center max-w-md">
            <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
            <p className="text-slate-500">You must be a Manager or Admin to view approvals.</p>
          </div>
        </div>
      </AppShell>
    )
  }

  const getMemberName = (item: any) => {
    if (item.member) return `${item.member.first_name} ${item.member.last_name}`
    return 'Unknown Member'
  }

  const getMemberInitials = (item: any) => {
    if (item.member) return item.member.first_name[0]
    return '?'
  }

  const getStatusColor = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'approved': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'rejected': return 'bg-rose-100 text-rose-700 border-rose-200'
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200'
      default: return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  const filteredItems = items.filter(i => 
    getMemberName(i).toLowerCase().includes(search.toLowerCase()) || 
    (i.reason || '').toLowerCase().includes(search.toLowerCase())
  )

  const filteredHistory = history.filter(i => 
    getMemberName(i).toLowerCase().includes(search.toLowerCase()) || 
    (i.reason || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <AppShell title="Break Approvals">
      <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 bg-white/50 backdrop-blur-md p-2 pr-6 rounded-2xl border border-white/60 shadow-sm w-fit">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-3 rounded-xl shadow-lg shadow-indigo-500/20">
              <Coffee size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Break Approvals</h1>
              <p className="text-xs text-slate-500 font-medium">Review and manage break requests</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
             {role === 'super_admin' ? (
                <div className="relative">
                   <select 
                      value={orgId} 
                      onChange={(e)=>setOrgId(e.target.value)}
                      className="appearance-none pl-4 pr-10 py-2.5 bg-white/50 border border-white/60 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm cursor-pointer hover:bg-white/80 transition-colors"
                   >
                      <option value="">Select Organization</option>
                      {orgs.map(o => <option key={o.id} value={o.id}>{o.orgName}</option>)}
                   </select>
                   <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
                </div>
             ) : (
                <div className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-bold border border-indigo-100 shadow-sm">
                   {orgs.find(o => o.id === orgId)?.orgName || 'Loading...'}
                </div>
             )}

             <ExportMenu isExporting={isExporting} onExport={handleExport} />
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-3xl overflow-hidden shadow-2xl shadow-indigo-100/50 min-h-[400px]">
           {/* Toolbar */}
           <div className="p-4 border-b border-white/50 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white/20">
              {/* Tabs */}
              <div className="flex p-1 bg-slate-100/50 rounded-xl border border-white/50 shadow-inner w-full sm:w-auto">
                 <button
                    onClick={() => setActiveTab('pending')}
                    className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                       activeTab === 'pending' 
                       ? 'bg-white text-indigo-600 shadow-sm scale-[1.02]' 
                       : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
                    }`}
                 >
                    <Clock size={16} />
                    Pending
                    {items.length > 0 && (
                       <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1 shadow-sm shadow-rose-200">
                          {items.length}
                       </span>
                    )}
                 </button>
                 <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                       activeTab === 'history' 
                       ? 'bg-white text-indigo-600 shadow-sm scale-[1.02]' 
                       : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
                    }`}
                 >
                    <Calendar size={16} />
                    History
                 </button>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64 group">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
                 <input 
                    type="text" 
                    placeholder="Search requests..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white/50 border border-white/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all placeholder:text-slate-400"
                 />
              </div>
           </div>

           {/* Content Area */}
           <div className="overflow-x-auto">
              <table className="w-full">
                 <thead>
                    <tr className="bg-indigo-50/30 border-b border-indigo-50">
                       <th className="px-6 py-4 text-left text-xs font-bold text-indigo-900/50 uppercase tracking-wider first:pl-8">Member</th>
                       <th className="px-6 py-4 text-left text-xs font-bold text-indigo-900/50 uppercase tracking-wider">Break Session</th>
                       <th className="px-6 py-4 text-left text-xs font-bold text-indigo-900/50 uppercase tracking-wider">Requested At</th>
                       <th className="px-6 py-4 text-left text-xs font-bold text-indigo-900/50 uppercase tracking-wider">Reason</th>
                       <th className="px-6 py-4 text-left text-xs font-bold text-indigo-900/50 uppercase tracking-wider">Status</th>
                       {activeTab === 'history' && <th className="px-6 py-4 text-left text-xs font-bold text-indigo-900/50 uppercase tracking-wider">Reviewed At</th>}
                       <th className="px-6 py-4 text-left text-xs font-bold text-indigo-900/50 uppercase tracking-wider">Actions / Note</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-indigo-50/50">
                    {loading ? (
                       <tr><td colSpan={7} className="px-6 py-20 text-center text-slate-400">Loading requests...</td></tr>
                    ) : !orgId ? (
                       <tr><td colSpan={7} className="px-6 py-20 text-center text-slate-400">Please select an organization to view requests.</td></tr>
                    ) : activeTab === 'pending' ? (
                       filteredItems.length === 0 ? (
                          <tr>
                             <td colSpan={7} className="px-6 py-20 text-center text-slate-400">
                                <div className="flex flex-col items-center gap-3">
                                   <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-2 ring-4 ring-emerald-50/50">
                                      <CheckCircle size={32} className="text-emerald-300" />
                                   </div>
                                   <span className="font-medium text-slate-600">All caught up!</span>
                                   <span className="text-sm">No pending break requests found in <span className="font-semibold text-slate-500">{orgs.find(o=>o.id===orgId)?.orgName}</span>.</span>
                                </div>
                             </td>
                          </tr>
                       ) : (
                          filteredItems.map((item) => (
                             <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors group">
                                <td className="px-6 py-4 whitespace-nowrap first:pl-8">
                                   <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600 flex items-center justify-center text-sm font-bold border-2 border-white shadow-sm overflow-hidden">
                                        {item.member?.photo_url ? (
                                            <img src={item.member.photo_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            getMemberInitials(item)
                                        )}
                                      </div>
                                      <div>
                                         <div className="font-bold text-slate-700">{getMemberName(item)}</div>
                                         <div className="text-xs text-slate-400">Employee</div>
                                      </div>
                                   </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                   <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100">
                                      {item.break_session_id.substring(0,8)}...
                                   </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                   {new Date(item.created_at).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate" title={item.reason}>
                                   {item.reason}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                   <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getStatusColor(item.status)}`}>
                                      {item.status.toUpperCase()}
                                   </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                   <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button 
                                         onClick={()=>setOpen({ id: item.id, action:'approved' })}
                                         className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 hover:scale-105 transition-all shadow-sm border border-emerald-100"
                                         title="Approve"
                                      >
                                         <CheckCircle size={18} />
                                      </button>
                                      <button 
                                         onClick={()=>setOpen({ id: item.id, action:'rejected' })}
                                         className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 hover:scale-105 transition-all shadow-sm border border-rose-100"
                                         title="Reject"
                                      >
                                         <XCircle size={18} />
                                      </button>
                                   </div>
                                </td>
                             </tr>
                          ))
                       )
                    ) : (
                       // History Tab
                       filteredHistory.length === 0 ? (
                          <tr><td colSpan={7} className="px-6 py-20 text-center text-slate-400">No review history found.</td></tr>
                       ) : (
                          filteredHistory.map((item) => (
                             <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap first:pl-8">
                                   <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold border border-white shadow-sm overflow-hidden">
                                        {item.member?.photo_url ? (
                                            <img src={item.member.photo_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            getMemberInitials(item)
                                        )}
                                      </div>
                                      <div className="font-medium text-slate-700">{getMemberName(item)}</div>
                                   </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                   {item.break_session_id.substring(0,8)}...
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                   {new Date(item.created_at).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate" title={item.reason}>
                                   {item.reason}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                   <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getStatusColor(item.status)}`}>
                                      {item.status.toUpperCase()}
                                   </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                   {new Date(item.reviewed_at).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate" title={item.review_note}>
                                   {item.review_note || '-'}
                                </td>
                             </tr>
                          ))
                       )
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      </div>

      {/* Review Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`p-6 ${open.action === 'approved' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
              <h3 className={`text-xl font-bold ${open.action === 'approved' ? 'text-emerald-800' : 'text-rose-800'}`}>
                {open.action === 'approved' ? 'Approve Request' : 'Reject Request'}
              </h3>
              <p className={`text-sm ${open.action === 'approved' ? 'text-emerald-600' : 'text-rose-600'}`}>
                Are you sure you want to {open.action} this break request?
              </p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Review Note <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm min-h-[100px]"
                  placeholder="Add a note for the employee..."
                  value={note}
                  onChange={(e)=> setNote(e.target.value)}
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-2">
                <button 
                  onClick={() => setOpen(null)}
                  className="px-5 py-2.5 rounded-xl text-slate-600 font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={review}
                  className={`px-5 py-2.5 rounded-xl text-white font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95 ${
                    open.action === 'approved' 
                      ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200' 
                      : 'bg-rose-500 hover:bg-rose-600 shadow-rose-200'
                  }`}
                >
                  Confirm {open.action === 'approved' ? 'Approval' : 'Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
