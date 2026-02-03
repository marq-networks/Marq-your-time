'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@components/ui/AppShell'
import { normalizeRoleForApi } from '@lib/permissions'
import ExportMenu from '@components/shared/ExportMenu'
import { exportToCsv, exportToPdf, type ExportColumn } from '@lib/export-utils'
import { DayPicker, DateRange } from 'react-day-picker'
import { Calendar as CalendarIcon, Clock, CheckCircle2, XCircle, AlertCircle, Plus, FileText, ChevronRight, ChevronLeft, Briefcase, Plane, Sun } from 'lucide-react'
import 'react-day-picker/dist/style.css'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string }
type LeaveType = { leave_type_id: string, name: string, balance: number, code: string, paid: boolean }

function monthDays(date: Date) { const start = new Date(date.getFullYear(), date.getMonth(), 1); const end = new Date(date.getFullYear(), date.getMonth()+1, 0); const arr: string[] = []; for (let d = new Date(start); d <= end; d = new Date(d.getTime()+24*60*60*1000)) arr.push(d.toISOString().slice(0,10)); return arr }
function inRange(d: string, s: string, e: string) { return d >= s && d <= e }

export default function LeavePage() {
  const router = useRouter()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [members, setMembers] = useState<User[]>([])
  const [orgId, setOrgId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [types, setTypes] = useState<LeaveType[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [role, setRole] = useState('')
  const [seeded, setSeeded] = useState(false)
  const [month, setMonth] = useState<Date>(() => new Date())
  const [range, setRange] = useState<DateRange | undefined>(undefined)
  const [isExporting, setIsExporting] = useState(false)

  // Load balances and types
  const loadBalances = async (oid: string, mid: string) => {
    if (!oid || !mid) return
    const res = await fetch(`/api/leave/balances?org_id=${oid}&member_id=${mid}`, { cache:'no-store' })
    const d = await res.json()
    const items = d.items || []
    setTypes(items)
  }

  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      if (requests.length === 0) {
        alert('No data to export')
        return
      }
      const exportItems = requests.map(r => ({
        ...r,
        typeName: types.find(t => t.leave_type_id === r.leave_type_id)?.name || 'Unknown',
        status: r.status
      }))
      const exportColumns: ExportColumn[] = [
        { header: 'Type', accessor: 'typeName' },
        { header: 'Start', accessor: 'start_date' },
        { header: 'End', accessor: 'end_date' },
        { header: 'Days', accessor: (item) => String(item.days_count || 0) },
        { header: 'Status', accessor: 'status' },
        { header: 'Reason', accessor: (item) => item.reason || '' }
      ]
      const filename = `leave_requests_${memberId}_${new Date().toISOString().split('T')[0]}`
      if (type === 'csv') {
        await exportToCsv(exportItems, exportColumns, filename)
      } else {
        await exportToPdf(exportItems, exportColumns, 'Leave Requests', filename)
      }
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
      const cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
      const preferred = items.find(o => o.id === cookieOrgId)?.id || items[0].id
      setOrgId(preferred)
    }
  }
  
  const loadMembers = async (oid: string) => {
    const res = await fetch(`/api/user/list?orgId=${oid}`, { cache:'no-store' })
    const d = await res.json()
    const items: User[] = Array.isArray(d.items) ? (d.items as User[]) : []
    setMembers(items)
    if (!memberId && items.length) {
      const cookieUserId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('current_user_id='))?.split('=')[1] || '') : ''
      const preferredMember = items.find(m => m.id === cookieUserId)?.id || items[0].id
      setMemberId(preferredMember)
    }
  }

  const loadMy = async (mid: string) => { const res = await fetch(`/api/leave/my-requests?member_id=${mid}`, { cache:'no-store' }); const d = await res.json(); setRequests(d.items||[]) }
  
  useEffect(()=>{ try { const r = normalizeRoleForApi((typeof document !== 'undefined' ? (document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('current_role='))?.split('=')[1] || '') : '')); setRole(r) } catch {} }, [])
  useEffect(()=>{ loadOrgs() }, [role])
  useEffect(()=>{ if(orgId) { loadMembers(orgId) } }, [orgId])
  useEffect(()=>{ if(orgId && memberId) { loadBalances(orgId, memberId); loadMy(memberId) } }, [orgId, memberId])
  
  // Seeding logic
  useEffect(()=>{ 
    if (orgId && types.length === 0 && !seeded) {
      // (This logic is kept but might need check if types are empty)
      // For now, we assume balances endpoint returns types if they exist
    }
  }, [types, orgId, seeded])

  // Calendar Modifiers
  const pendingSet = new Set<string>()
  const approvedSet = new Set<string>()
  
  function getDatesInRange(s: string, e: string) {
    const out: string[] = []
    if (!s || !e) return out
    for (let d = new Date(s+'T00:00:00'); d <= new Date(e+'T00:00:00'); d = new Date(d.getTime()+24*60*60*1000)) {
      out.push(d.toISOString().slice(0,10))
    }
    return out
  }

  for (const r of requests) {
    const dates = getDatesInRange(r.start_date, r.end_date)
    if (r.status === 'approved') dates.forEach(d => approvedSet.add(d))
    else if (r.status === 'pending') dates.forEach(d => pendingSet.add(d))
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'approved': return 'bg-green-100 text-green-700 border-green-200'
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'rejected': return 'bg-red-100 text-red-700 border-red-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'approved': return <CheckCircle2 size={14} />
      case 'pending': return <Clock size={14} />
      case 'rejected': return <XCircle size={14} />
      default: return <AlertCircle size={14} />
    }
  }

  return (
    <AppShell title="Leave Management">
      <div className="flex flex-col gap-6 pb-8 text-[var(--color-text-primary)]">
        
        {/* Header Controls */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-white/20 shadow-sm">
           <div className="flex flex-wrap gap-4 items-center w-full md:w-auto">
             {/* Org Selector */}
             {(role === 'super_admin') && (
               <div className="flex flex-col gap-1">
                 <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</label>
                 <select 
                   value={orgId} 
                   onChange={(e)=>setOrgId(e.target.value)}
                   className="bg-white/80 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                 >
                   {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
                 </select>
               </div>
             )}
             
             {/* Member Selector */}
             {(!['employee','member'].includes(role)) && (
               <div className="flex flex-col gap-1">
                 <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Member</label>
                 <select 
                    value={memberId} 
                    onChange={(e)=>setMemberId(e.target.value)}
                    className="bg-white/80 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                 >
                    {members.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
                 </select>
               </div>
             )}
           </div>

           <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <ExportMenu isExporting={isExporting} onExport={handleExport} />
              <button 
                onClick={() => router.push('/leave/new')}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-500/20"
              >
                <Plus size={16} />
                <span>New Request</span>
              </button>
           </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {types.map((t) => (
            <div key={t.leave_type_id} className="bg-white/60 backdrop-blur-md p-5 rounded-2xl border border-white/40 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
               <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity ${t.paid ? 'text-green-600' : 'text-orange-600'}`}>
                 {t.code === 'SICK' ? <AlertCircle size={48} /> : t.code === 'ANNUAL' ? <Sun size={48} /> : <Briefcase size={48} />}
               </div>
               <div className="flex flex-col gap-1">
                 <span className="text-sm font-medium text-gray-500">{t.name}</span>
                 <div className="flex items-baseline gap-1">
                   <span className="text-3xl font-bold text-gray-800">{t.balance}</span>
                   <span className="text-sm text-gray-400">days left</span>
                 </div>
               </div>
               <div className="mt-3 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                 <div 
                    className={`h-full rounded-full ${t.paid ? 'bg-green-500' : 'bg-orange-400'}`} 
                    style={{ width: `${Math.min((t.balance / 20) * 100, 100)}%` }} 
                 />
               </div>
            </div>
          ))}
          {types.length === 0 && (
             <div className="col-span-full p-8 text-center bg-white/40 rounded-2xl border border-dashed border-gray-300 text-gray-500">
               No leave types configured. {['admin','owner'].includes(role) && 'Please configure leave types in Settings.'}
             </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Section */}
          <div className="lg:col-span-2 flex flex-col gap-4">
             <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/50 shadow-sm overflow-hidden flex flex-col h-full min-h-[600px]">
               {/* Custom Header */}
               <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white/40">
                 <h2 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                   <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                     <CalendarIcon size={20} />
                   </div>
                   {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                 </h2>
                 <div className="flex items-center gap-1 bg-white border border-gray-200 p-1 rounded-xl shadow-sm">
                   <button onClick={()=>{ const dt = new Date(new Date(month).setMonth(month.getMonth()-1)); setMonth(dt) }} className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-600"><ChevronLeft size={18} /></button>
                   <button onClick={()=>{ setMonth(new Date()) }} className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">Today</button>
                   <button onClick={()=>{ const dt = new Date(new Date(month).setMonth(month.getMonth()+1)); setMonth(dt) }} className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-600"><ChevronRight size={18} /></button>
                 </div>
               </div>
               
               <div className="flex-1 w-full p-6 pt-2">
                  <DayPicker
                    month={month}
                    onMonthChange={setMonth}
                    mode="range"
                    selected={range}
                    onSelect={(r)=>{ 
                      setRange(r||undefined); 
                      if (r?.from && r?.to) {
                        const s = r.from.toISOString().slice(0,10); 
                        const e = r.to.toISOString().slice(0,10); 
                        router.push(`/leave/new?start=${s}&end=${e}`);
                      }
                    }}
                    showOutsideDays
                    className="w-full"
                    classNames={{
                      months: "w-full",
                      month: "w-full",
                      table: "w-full border-collapse",
                      head_row: "border-b border-gray-100",
                      head_cell: "text-gray-400 font-medium text-xs uppercase tracking-wider py-4 text-center",
                      row: "border-b border-gray-100 last:border-0",
                      cell: "border-r border-gray-100 last:border-0 h-28 p-0 relative hover:bg-gray-50 transition-colors focus-within:relative focus-within:z-20 align-top",
                      day: "w-full h-full p-2 flex flex-col items-start justify-start text-sm cursor-pointer hover:bg-transparent outline-none",
                      day_selected: "bg-blue-50/50",
                      day_today: "bg-gray-50/50",
                      day_outside: "text-slate-300 bg-slate-50/20"
                    }}
                    components={{
                      DayContent: (props) => {
                        const dStr = props.date.toISOString().slice(0,10)
                        const isApproved = approvedSet.has(dStr)
                        const isPending = pendingSet.has(dStr)
                        return (
                          <div className="w-full h-full flex flex-col justify-between">
                            <span className={`font-medium ${props.activeModifiers.today ? 'bg-blue-600 text-white w-7 h-7 flex items-center justify-center rounded-full shadow-md shadow-blue-500/20' : 'text-slate-700'}`}>
                              {props.date.getDate()}
                            </span>
                            <div className="flex flex-col gap-1 w-full">
                              {isApproved && (
                                <div className="w-full px-2 py-1 rounded-md bg-green-100 text-green-700 text-[10px] font-medium border border-green-200 truncate">
                                  Approved
                                </div>
                              )}
                              {isPending && (
                                <div className="w-full px-2 py-1 rounded-md bg-yellow-100 text-yellow-700 text-[10px] font-medium border border-yellow-200 truncate">
                                  Pending
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      }
                    }}
                  />
               </div>
               
               <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500"></div> Approved</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-yellow-500"></div> Pending</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-200"></div> Holiday</div>
                  </div>
                  <div>Click and drag to select range</div>
               </div>
             </div>
          </div>

          {/* Recent Requests List */}
          <div className="flex flex-col gap-4">
             <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/50 shadow-sm p-6 flex-1">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <FileText size={20} className="text-gray-400" />
                  Recent Requests
                </h2>
                
                <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {requests.length === 0 && (
                    <div className="text-center py-10 text-gray-400">No requests found</div>
                  )}
                  {requests.map((r) => (
                    <div key={r.id} className="p-4 rounded-2xl bg-white/50 border border-white/60 hover:bg-white/80 transition-all group">
                       <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold px-2 py-1 rounded-md bg-gray-100 text-gray-600 uppercase tracking-wider">{r.type_name || r.type_code}</span>
                          <span className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1 ${getStatusColor(r.status)}`}>
                            {getStatusIcon(r.status)}
                            <span className="capitalize">{r.status}</span>
                          </span>
                       </div>
                       <div className="flex flex-col gap-1 mb-2">
                          <div className="text-sm font-semibold text-gray-800">
                             {new Date(r.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(r.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                          <div className="text-xs text-gray-500">
                            {r.days_count} days • {new Date(r.created_at).toLocaleDateString()}
                          </div>
                       </div>
                       {r.reason && (
                         <div className="text-sm text-gray-600 bg-gray-50/50 p-2 rounded-lg italic border border-gray-100/50">
                           "{r.reason}"
                         </div>
                       )}
                    </div>
                  ))}
                </div>
             </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
