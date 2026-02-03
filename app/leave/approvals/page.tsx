'use client'
import { useEffect, useState } from 'react'
import AppShell from '@/components/ui/AppShell'
import ExportMenu from '@/components/shared/ExportMenu'
import { exportToCsv, exportToPdf, ExportColumn } from '@/lib/export-utils'
import { normalizeRoleForApi } from '@/lib/permissions'
import { Calendar, CheckCircle, XCircle, Clock, Users, FileText, Search, Filter, ChevronRight, AlertCircle, Check, RefreshCw, History, ArrowRight } from 'lucide-react'

type Org = { id: string, orgName: string }
type Member = { id: string, firstName: string, lastName: string, profileImage?: string }

export default function LeaveApprovalsPage() {
  const [forbidden, setForbidden] = useState(false)
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(false)
  
  const [open, setOpen] = useState<{ id?: string, action?: 'approved'|'rejected' } | null>(null)
  const [note, setNote] = useState('')
  const [role, setRole] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')

  const getHeaders = () => {
    const headers: any = {
      'Content-Type': 'application/json'
    }
    if (typeof document !== 'undefined') {
      const uid = document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_user_id='))?.split('=')[1]
      if (uid) headers['x-user-id'] = uid
      
      const r = document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1]
      if (r) headers['x-role'] = normalizeRoleForApi(r)
      
      if (orgId) headers['x-org-id'] = orgId
    }
    return headers
  }

  const loadOrgs = async () => {
    try {
      const endpoint = role === 'super_admin' ? '/api/org/list' : '/api/orgs/my'
      const res = await fetch(endpoint, { 
        cache:'no-store',
        headers: getHeaders()
      })
      if (res.status === 403) {
        setForbidden(true)
        setLoading(false)
        return
      }
      const d = await res.json()
      const items: Org[] = Array.isArray(d.items) ? (d.items as Org[]) : []
      setOrgs(items)
      
      if (!orgId && items.length) {
        const cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
        const preferred = items.find(o => o.id === cookieOrgId)?.id || items[0].id
        setOrgId(preferred)
      } else if (items.length === 0) {
        setLoading(false)
      }
    } catch (e) {
      console.error(e)
      setLoading(false)
    }
  }

  const loadMembers = async () => {
    if (!orgId) return
    setMembersLoading(true)
    try {
      const res = await fetch(`/api/user/list?orgId=${orgId}&pageSize=1000`, { 
        cache: 'no-store',
        headers: getHeaders()
      })
      const data = await res.json()
      setMembers(data.items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setMembersLoading(false)
    }
  }

  const loadData = async () => {
    if(!orgId) return
    setLoading(true)
    try {
      const headers = getHeaders()
      
      const res = await fetch(`/api/leave/requests?org_id=${orgId}`, { 
        cache: 'no-store', 
        headers 
      })

      if (res.status === 403) {
        setForbidden(true)
        setLoading(false)
        return
      }

      const data = await res.json().catch(() => ({ items: [] }))
      const allItems = Array.isArray(data.items) ? data.items : []

      const pending = allItems.filter((i: any) => i.status === 'pending')
      const historyItems = allItems.filter((i: any) => i.status !== 'pending')
        .sort((x:any,y:any)=> new Date(y.reviewed_at||y.created_at||0).getTime() - new Date(x.reviewed_at||x.created_at||0).getTime())
        .slice(0, 50)

      setItems(pending)
      setHistory(historyItems)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const review = async () => {
    if(!open?.id || !open?.action) return
    try {
      const res = await fetch('/api/leave/review', { 
        method:'POST', 
        headers: getHeaders(), 
        body: JSON.stringify({ request_id: open.id, status: open.action, note }) 
      })
      
      if (res.status === 403) { setForbidden(true); return }
      
      setOpen(null)
      setNote('')
      loadData()
    } catch (e) {
      console.error(e)
      alert('Failed to submit review')
    }
  }

  const handleExport = async (type: 'csv' | 'pdf') => {
    if (!orgId) return
    setIsExporting(true)
    try {
      const allItems = [
        ...items.map(i => ({ ...i, status: 'pending' })),
        ...history
      ]
      const exportColumns: ExportColumn[] = [
        { header: 'Member', accessor: (i) => {
            const m = members.find(m => m.id === i.member_id)
            return m ? `${m.firstName} ${m.lastName}` : 'Unknown'
        }},
        { header: 'Type', accessor: 'type_code' },
        { header: 'Start Date', accessor: 'start_date' },
        { header: 'End Date', accessor: 'end_date' },
        { header: 'Days', accessor: (i) => String(i.days_count || 0) },
        { header: 'Reason', accessor: 'reason' },
        { header: 'Status', accessor: 'status' },
        { header: 'Reviewed At', accessor: (i) => i.reviewed_at ? new Date(i.reviewed_at).toLocaleString() : '-' },
        { header: 'Note', accessor: 'review_note' },
      ]
      const filename = `marq_leave_approvals_${new Date().toISOString().split('T')[0]}`
      if (type === 'csv') exportToCsv(allItems, exportColumns, filename)
      else exportToPdf(allItems, exportColumns, 'Leave Approvals', filename)
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  useEffect(() => {
    try {
      const r = normalizeRoleForApi((typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''))
      setRole(r)
    } catch {}
  }, [])

  useEffect(() => {
    loadOrgs()
  }, [role])

  useEffect(() => {
    if (orgId) {
      loadMembers()
      loadData()
    }
  }, [orgId])

  if (forbidden) {
    return (
      <AppShell title="Leave Approvals">
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

  const getMemberName = (id: string) => {
    if (!id) return 'Unknown Member'
    const m = members.find(m => m.id === id)
    return m ? `${m.firstName} ${m.lastName}` : 'Unknown Member'
  }

  const getMemberInitials = (id: string) => {
    if (!id) return '?'
    const m = members.find(m => m.id === id)
    return m ? m.firstName[0] : '?'
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
    getMemberName(i.member_id).toLowerCase().includes(search.toLowerCase()) || 
    i.type_code?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredHistory = history.filter(i => 
    getMemberName(i.member_id).toLowerCase().includes(search.toLowerCase()) || 
    i.type_code?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <AppShell title="Leave Approvals">
      <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-10">
        
        {/* Controls */}
        <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-3xl p-6 shadow-xl shadow-indigo-100/50 flex flex-col md:flex-row gap-6 justify-between items-center z-10">
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

             <div className="relative flex-1 max-w-md group hidden md:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search requests..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white/80 border border-indigo-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm font-medium text-slate-700 placeholder-indigo-300 transition-all hover:border-indigo-300"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => { loadData(); loadMembers(); }} 
              disabled={loading || !orgId}
              className="p-3 bg-white/80 border border-indigo-100 rounded-xl text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all disabled:opacity-50 shadow-sm"
              title="Refresh Data"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <ExportMenu onExport={handleExport} isExporting={isExporting} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('pending')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'pending' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                : 'bg-white/40 text-slate-600 hover:bg-white/60'
            }`}
          >
            <Clock size={16} />
            Pending Requests
            {filteredItems.length > 0 && (
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs ml-1">
                {filteredItems.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'history' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                : 'bg-white/40 text-slate-600 hover:bg-white/60'
            }`}
          >
            <History size={16} />
            Review History
          </button>
        </div>

        {/* Main Content */}
        <div className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-3xl overflow-hidden shadow-2xl shadow-indigo-100/50 min-h-[400px]">
          {activeTab === 'pending' ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-indigo-100/50 bg-indigo-50/30">
                    <th className="px-6 py-5 text-left text-xs font-bold text-indigo-400 uppercase tracking-wider first:pl-8">Member</th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-indigo-400 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-indigo-400 uppercase tracking-wider">Dates</th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-indigo-400 uppercase tracking-wider">Days</th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-indigo-400 uppercase tracking-wider">Reason</th>
                    <th className="px-6 py-5 text-right text-xs font-bold text-indigo-400 uppercase tracking-wider last:pr-8">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-50">
                  {loading ? (
                    <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-400">Loading requests...</td></tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-2 ring-4 ring-emerald-50/50">
                            <CheckCircle size={32} className="text-emerald-300" />
                          </div>
                          <span className="font-medium text-slate-600">All caught up!</span>
                          <span className="text-sm">No pending requests found in <span className="font-semibold text-slate-500">{orgs.find(o=>o.id===orgId)?.orgName}</span>.</span>
                          {search && <span className="text-xs text-slate-400">(Filtered by search)</span>}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap first:pl-8">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600 flex items-center justify-center text-sm font-bold border-2 border-white shadow-sm">
                              {getMemberInitials(item.member_id)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-700">{getMemberName(item.member_id)}</div>
                              <div className="text-xs text-slate-400">Employee</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100">
                            {item.type_code}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          <div className="flex items-center gap-2 bg-white/50 px-3 py-1.5 rounded-lg border border-indigo-50 w-fit">
                            <Calendar size={14} className="text-indigo-400" />
                            <span className="font-medium">{item.start_date}</span>
                            <ArrowRight size={12} className="text-slate-300" />
                            <span className="font-medium">{item.end_date}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">{item.days_count} days</span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-500 line-clamp-1 max-w-[200px] italic" title={item.reason}>{item.reason || 'No reason provided'}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right last:pr-8">
                          <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => setOpen({ id: item.id, action: 'approved' })}
                              className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all border border-emerald-100 hover:shadow-lg hover:shadow-emerald-200"
                              title="Approve"
                            >
                              <Check size={18} />
                            </button>
                            <button 
                              onClick={() => setOpen({ id: item.id, action: 'rejected' })}
                              className="p-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white transition-all border border-rose-100 hover:shadow-lg hover:shadow-rose-200"
                              title="Reject"
                            >
                              <XCircle size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-indigo-100/50 bg-indigo-50/30">
                    <th className="px-6 py-5 text-left text-xs font-bold text-indigo-400 uppercase tracking-wider first:pl-8">Member</th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-indigo-400 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-indigo-400 uppercase tracking-wider">Dates</th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-indigo-400 uppercase tracking-wider">Days</th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-indigo-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-indigo-400 uppercase tracking-wider">Reviewed At</th>
                    <th className="px-6 py-5 text-left text-xs font-bold text-indigo-400 uppercase tracking-wider last:pr-8">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-50">
                  {loading ? (
                    <tr><td colSpan={7} className="px-6 py-20 text-center text-slate-400">Loading history...</td></tr>
                  ) : filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-20 text-center text-slate-400">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-2 ring-4 ring-slate-50/50">
                            <History size={32} className="text-slate-300" />
                          </div>
                          <span className="font-medium text-slate-600">No history available</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap first:pl-8">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold border border-white">
                              {getMemberInitials(item.member_id)}
                            </div>
                            <div className="font-medium text-slate-700">{getMemberName(item.member_id)}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-600">{item.type_code}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {item.start_date} <span className="text-slate-300 mx-1">→</span> {item.end_date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {item.days_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getStatusColor(item.status)}`}>
                            {item.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {item.reviewed_at ? new Date(item.reviewed_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 last:pr-8">
                          {item.review_note || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal */}
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className={`p-6 ${open.action === 'approved' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                <h3 className={`text-xl font-bold ${open.action === 'approved' ? 'text-emerald-800' : 'text-rose-800'}`}>
                  {open.action === 'approved' ? 'Approve Request' : 'Reject Request'}
                </h3>
                <p className={`text-sm ${open.action === 'approved' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  Are you sure you want to {open.action} this request?
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

      </div>
    </AppShell>
  )
}
