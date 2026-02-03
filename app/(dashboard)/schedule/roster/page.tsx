'use client'
import { useEffect, useMemo, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import ExportMenu from '@components/shared/ExportMenu'
import { exportToCsv, exportToPdf, ExportColumn } from '@lib/export-utils'
import { normalizeRoleForApi } from '@lib/permissions'
import { Calendar, Filter, Users, ChevronLeft, ChevronRight, Plus, X, Search, Building2, Briefcase } from 'lucide-react'

type Org = { id: string, orgName: string }
type Department = { id: string, name: string }
type User = { id: string, firstName: string, lastName: string, departmentId?: string, memberRoleId?: string, profileImage?: string }
type Shift = { id: string, name: string, startTime: string, endTime: string, color?: string }
type Assignment = { id: string, memberId: string, shiftId: string, effectiveFrom: string, effectiveTo?: string }

function weekDays(baseDate: string) {
  const dt = new Date(baseDate + 'T00:00:00')
  const day = dt.getDay()
  const mondayOffset = ((day + 6) % 7)
  const monday = new Date(dt.getTime() - mondayOffset*24*60*60*1000)
  const arr: string[] = []
  for (let i=0;i<7;i++) arr.push(new Date(monday.getTime() + i*24*60*60*1000).toISOString().slice(0,10))
  return arr
}

function formatDate(d: string) {
  const date = new Date(d + 'T00:00:00')
  return {
    dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
    dayNum: date.getDate(),
    full: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

export default function RosterPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [members, setMembers] = useState<User[]>([])
  const [departmentId, setDepartmentId] = useState('')
  const [date, setDate] = useState(()=> new Date().toISOString().slice(0,10))
  const [shifts, setShifts] = useState<Shift[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selecting, setSelecting] = useState<{memberId?:string, day?:string}>({})
  const [selShift, setSelShift] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [loading, setLoading] = useState(true)
  const role = typeof document !== 'undefined' ? normalizeRoleForApi(document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''

  function getCookie(name: string) {
    if (typeof document === 'undefined') return ''
    return document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(`${name}=`))?.split('=')[1] || ''
  }

  const getHeaders = () => ({
    'x-user-id': getCookie('current_user_id'),
    'x-role': role || 'admin',
    'x-org-id': orgId
  })

  const loadOrgs = async () => { 
    try {
      const res = await fetch('/api/orgs/my', { 
        cache: 'no-store',
        headers: {
          'x-user-id': getCookie('current_user_id')
        }
      })
      if (res.status === 401) {
        setLoading(false)
        return
      }
      const d = await res.json()
      setOrgs(d.items || [])
      if (!orgId && d.items?.length) {
        const cookieOrg = getCookie('current_org_id')
        const found = d.items.find((o: Org) => o.id === cookieOrg)
        const nextId = found ? found.id : d.items[0].id
        setOrgId(nextId)
        // Safety: if for some reason effect doesn't fire (e.g. same ID), ensure we don't hang
        if (nextId === orgId) setLoading(false)
      } else {
        setLoading(false)
      }
    } catch (e) {
      console.error(e)
      setLoading(false)
    }
  }

  const loadDepsUsers = async (oid: string) => { 
    setLoading(true)
    try {
      const headers = { 'x-user-id': getCookie('current_user_id') }
      const [deps, users] = await Promise.all([ 
        fetch(`/api/department/list?orgId=${oid}`, { headers }).then(r => r.json()), 
        fetch(`/api/user/list?orgId=${oid}&pageSize=1000`, { headers }).then(r => r.json()) 
      ])
      setDepartments(deps.items || [])
      setMembers(users.items || []) 
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadShifts = async (oid: string) => { 
    try {
      const res = await fetch(`/api/shifts?org_id=${oid}`, { 
        cache:'no-store',
        headers: getHeaders()
      })
      const d = await res.json()
      setShifts(d.items || [])
    } catch (e) {
      console.error(e)
    }
  }

  const loadAssignments = async (oid: string) => { 
    try {
      const res = await fetch(`/api/shifts/assign?org_id=${oid}`, { 
        cache: 'no-store', 
        headers: getHeaders()
      })
      const d = await res.json()
      setAssignments(d.items || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId) { loadDepsUsers(orgId); loadShifts(orgId); loadAssignments(orgId) } }, [orgId])

  const days = useMemo(()=> weekDays(date), [date])
  const memberRows = useMemo(()=> members.filter(m=> !departmentId || m.departmentId===departmentId), [members, departmentId])
  const asgMap = useMemo(()=> {
    const map = new Map<string,string>()
    for (const a of assignments) for (const day of days) if (day >= a.effectiveFrom && (!a.effectiveTo || day <= a.effectiveTo)) map.set(`${a.memberId}|${day}`, a.shiftId)
    return map
  }, [assignments, days])

  const assignOne = async () => {
    if (!selecting.memberId || !selecting.day || !selShift) return
    try {
      const res = await fetch('/api/shifts/assign', { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'x-role': role || 'admin',
          'x-org-id': orgId,
          'x-user-id': getCookie('current_user_id')
        }, 
        body: JSON.stringify({ 
          member_id: selecting.memberId, 
          shift_id: selShift, 
          effective_from: selecting.day, 
          effective_to: selecting.day 
        }) 
      })
      if (res.ok) { 
        setSelecting({})
        setSelShift('')
        loadAssignments(orgId) 
      } else {
        alert('Failed to assign shift')
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleExport = async (type: 'csv' | 'pdf') => {
    if (!orgId) return
    setIsExporting(true)
    try {
      const exportItems = memberRows
      const exportColumns: ExportColumn[] = [
        { header: 'Member', accessor: (m: any) => `${m.firstName} ${m.lastName}` }
      ]
      days.forEach(d => {
        exportColumns.push({
          header: d,
          accessor: (m: any) => {
            const sId = asgMap.get(`${m.id}|${d}`)
            const s = shifts.find(x => x.id === sId)
            return s ? s.name : '-'
          }
        })
      })

      const filename = `marq_roster_${date}_${new Date().toISOString().split('T')[0]}`

      if (type === 'csv') {
        await exportToCsv(exportItems, exportColumns, filename)
      } else {
        await exportToPdf(exportItems, exportColumns, `Roster Week of ${date}`, filename)
      }
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const shiftColors = ['bg-blue-100 text-blue-700 border-blue-200', 'bg-green-100 text-green-700 border-green-200', 'bg-purple-100 text-purple-700 border-purple-200', 'bg-orange-100 text-orange-700 border-orange-200']

  return (
    <AppShell title="Roster & Scheduling">
      <div className="space-y-6">
        {/* Filters Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-end gap-5">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Building2 size={14} /> Organization
                </label>
                <div className="relative">
                  <select 
                    className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none"
                    value={orgId} 
                    onChange={(e:any)=> setOrgId(e.target.value)}
                  >
                    <option value="">Select Organization</option>
                    {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronRight size={16} className="rotate-90" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Filter size={14} /> Department
                </label>
                <div className="relative">
                  <select 
                    className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none"
                    value={departmentId} 
                    onChange={(e:any)=> setDepartmentId(e.target.value)}
                  >
                    <option value="">All Departments</option>
                    {departments.map(d=> <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronRight size={16} className="rotate-90" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar size={14} /> Week Of
                </label>
                <input 
                  type="date" 
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={date} 
                  onChange={e=> setDate(e.target.value)} 
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ExportMenu onExport={handleExport} isExporting={isExporting} />
              <button 
                onClick={()=> loadAssignments(orgId)}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95"
              >
                <Search size={16} /> Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Roster Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-left w-[250px]">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <Users size={14} /> Member
                    </div>
                  </th>
                  {days.map((d, i) => {
                    const { dayName, dayNum, full } = formatDate(d)
                    const isToday = d === new Date().toISOString().slice(0,10)
                    return (
                      <th key={d} className={`px-4 py-3 text-left min-w-[140px] ${isToday ? 'bg-blue-50/50' : ''}`}>
                        <div className="flex flex-col">
                          <span className={`text-xs font-bold uppercase tracking-wider ${isToday ? 'text-blue-600' : 'text-slate-500'}`}>{dayName}</span>
                          <span className={`text-lg font-semibold ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>{dayNum}</span>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-medium">Loading roster...</span>
                      </div>
                    </td>
                  </tr>
                ) : memberRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <Users size={32} className="text-slate-300" />
                        <span className="text-sm font-medium">No members found</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  memberRows.map(m => (
                    <tr key={m.id} className="group hover:bg-blue-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${
                            m.profileImage ? '' : `bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700`
                          }`}>
                            {m.profileImage ? (
                              <img src={m.profileImage} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              m.firstName[0]
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold text-slate-800 truncate">{m.firstName} {m.lastName}</span>
                            <span className="text-xs text-slate-500 truncate">{departments.find(d=>d.id===m.departmentId)?.name || 'No Dept'}</span>
                          </div>
                        </div>
                      </td>
                      {days.map(d => {
                        const sId = asgMap.get(`${m.id}|${d}`)
                        const s = shifts.find(x => x.id === sId)
                        const isToday = d === new Date().toISOString().slice(0,10)
                        
                        return (
                          <td key={d} className={`px-4 py-3 relative ${isToday ? 'bg-blue-50/30' : ''}`}>
                            <div 
                              onClick={()=> setSelecting({ memberId: m.id, day: d })}
                              className={`
                                min-h-[48px] rounded-lg border border-transparent transition-all cursor-pointer flex items-center justify-center p-2
                                ${s ? 'bg-white shadow-sm border-slate-200 hover:border-blue-300 hover:shadow-md group/cell' : 'hover:bg-slate-100 hover:border-slate-200 border-dashed border-slate-100'}
                              `}
                            >
                              {s ? (
                                <div className="flex flex-col items-center gap-0.5 w-full">
                                  <span className="text-xs font-bold text-slate-700 text-center line-clamp-1">{s.name}</span>
                                  <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded-full">
                                    {s.startTime?.slice(0,5)} - {s.endTime?.slice(0,5)}
                                  </div>
                                </div>
                              ) : (
                                <Plus size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modern Modal */}
      {selecting.memberId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={()=> { setSelecting({}); setSelShift('') }} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Briefcase size={18} className="text-blue-600" />
                Assign Shift
              </h3>
              <button onClick={()=> { setSelecting({}); setSelShift('') }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Selected Date</label>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <Calendar size={16} className="text-slate-400" />
                  {selecting.day ? new Date(selecting.day).toLocaleDateString(undefined, { weekday:'long', year:'numeric', month:'long', day:'numeric'}) : ''}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Select Shift</label>
                <select 
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={selShift} 
                  onChange={(e:any)=> setSelShift(e.target.value)}
                >
                  <option value="">Select shift...</option>
                  {shifts.map(s=> (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startTime?.slice(0,5)} - {s.endTime?.slice(0,5)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={assignOne}
                  disabled={!selShift}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
                >
                  Confirm Assignment
                </button>
                <button 
                  onClick={()=> { setSelecting({}); setSelShift('') }}
                  className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold py-2.5 rounded-xl transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
