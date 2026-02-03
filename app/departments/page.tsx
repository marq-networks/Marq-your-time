'use client'

import { useEffect, useState } from 'react'
import { Building2, Users, Search, Plus, Calendar, MoreVertical, Edit2, Trash2, RefreshCw, Layers } from 'lucide-react'
import AppShell from '@components/ui/AppShell'
import GlassModal from '@components/ui/GlassModal'
import Toast from '@components/Toast'
import { normalizeRoleForApi } from '@lib/permissions'
import ExportMenu from '@components/shared/ExportMenu'
import { exportToCsv, exportToPdf, ExportColumn } from '@lib/export-utils'

type Org = { id: string, orgName: string }
type Department = { id: string, name: string, createdAt: number }
type User = { id: string, firstName: string, lastName: string, departmentId?: string }

export default function DepartmentsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<{m?:string,t?:'success'|'error'}>({})
  
  // Modal States
  const [createOpen, setCreateOpen] = useState(false)
  const [editDept, setEditDept] = useState<Department | null>(null)
  const [newName, setNewName] = useState('')
  
  const [isExporting, setIsExporting] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string>('')
  
  const role = typeof document !== 'undefined' ? normalizeRoleForApi(document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''

  const loadOrgs = async () => {
    try {
      const endpoint = role === 'super_admin' ? '/api/org/list' : '/api/orgs/my'
      const res = await fetch(endpoint, { cache:'no-store' })
      const d = await res.json()
      const items: Org[] = Array.isArray(d.items) ? (d.items as Org[]) : []
      setOrgs(items)
      
      const cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''

      if (!orgId) {
        if (items.length) {
          const preferred = items.find(o => o.id === cookieOrgId)?.id || items[0].id
          setOrgId(preferred)
        } else if (cookieOrgId) {
           // Fallback logic
           console.warn('Orgs list empty, using cookie org ID fallback')
           setOrgId(cookieOrgId)
           setOrgs([{ id: cookieOrgId, orgName: 'Current Organization' }])
        } else {
            setLoading(false)
        }
      }
    } catch (e) {
      console.error('Failed to load orgs', e)
      setLoading(false)
    }
  }

  const loadData = async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [uRes, dRes] = await Promise.all([
        fetch(`/api/user/list?orgId=${orgId}`, { cache:'no-store' }),
        fetch(`/api/department/list?orgId=${orgId}`, { cache: 'no-store' })
      ])
      const [uData, dData] = await Promise.all([uRes.json(), dRes.json()])
      setDepartments(dData.items || [])
      setUsers(uData.items || [])
    } catch (e) {
      console.error(e)
      setToast({ m: 'Failed to load data', t: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOrgs() }, [])
  useEffect(() => { if (orgId) loadData() }, [orgId])

  // Close menu on outside click
  useEffect(() => {
    const closeMenu = () => setOpenMenuId('')
    document.addEventListener('click', closeMenu)
    return () => document.removeEventListener('click', closeMenu)
  }, [])

  const membersCount = (id: string) => users.filter(u => u.departmentId === id).length

  const filteredDepts = departments.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      const exportItems = filteredDepts
      const exportColumns: ExportColumn[] = [
        { header: 'Name', accessor: 'name' },
        { header: 'Members Count', accessor: (d) => membersCount(d.id).toString() },
        { header: 'Created At', accessor: (d) => new Date(d.createdAt).toLocaleString() }
      ]

      const filename = `marq_departments_${new Date().toISOString().split('T')[0]}`

      if (type === 'csv') {
        await exportToCsv(exportItems, exportColumns, filename)
      } else {
        await exportToPdf(exportItems, exportColumns, 'Departments', filename)
      }
    } catch (e) {
      console.error(e)
      setToast({ m: 'Export failed', t: 'error' })
    } finally {
      setIsExporting(false)
    }
  }

  const create = async () => {
    if (!newName.trim()) return
    const res = await fetch('/api/department/create', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orgId, name: newName }) })
    const data = await res.json()
    if (res.ok) { 
        setCreateOpen(false); 
        setNewName(''); 
        setToast({ m:'Department created', t:'success' }); 
        loadData() 
    }
    else setToast({ m: data.error || 'Error', t:'error' })
  }

  const rename = async () => {
    if (!editDept || !newName.trim()) return
    const res = await fetch(`/api/department/${editDept.id}/update`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: newName }) })
    const data = await res.json()
    if (res.ok) { 
        setEditDept(null);
        setNewName('');
        setToast({ m:'Department renamed', t:'success' }); 
        loadData() 
    }
    else setToast({ m: data.error || 'Error', t:'error' })
  }

  const del = async (id: string) => {
    if(!confirm('Are you sure you want to delete this department?')) return
    const res = await fetch(`/api/department/${id}/delete`, { method:'POST' })
    const data = await res.json()
    if (res.ok) { setToast({ m:'Department deleted', t:'success' }); loadData() }
    else setToast({ m: data.error || 'Error', t:'error' })
  }

  return (
    <AppShell title="Departments">
      <div className="mb-6 space-y-6">
        
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="relative overflow-hidden bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl p-6 shadow-sm group hover:shadow-md transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Total Departments</div>
                  <div className="text-2xl font-bold text-gray-800">{departments.length}</div>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl p-6 shadow-sm group hover:shadow-md transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Total Assigned</div>
                  <div className="text-2xl font-bold text-gray-800">{users.filter(u=>u.departmentId).length}</div>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl p-6 shadow-sm group hover:shadow-md transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Avg. Team Size</div>
                  <div className="text-2xl font-bold text-gray-800">
                    {departments.length ? Math.round(users.filter(u=>u.departmentId).length / departments.length) : 0}
                  </div>
                </div>
              </div>
            </div>
        </div>

        {/* Integrated Filter Bar */}
        <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl p-2 shadow-sm flex flex-col md:flex-row items-center gap-3">
          
          {/* Search */}
          <div className="flex-1 w-full md:w-auto relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search departments..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white/50 border-transparent focus:bg-white focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all rounded-xl text-sm outline-none placeholder:text-gray-400"
            />
          </div>

          <div className="w-px h-8 bg-gray-200 hidden md:block"></div>

          {/* Org Selector */}
          <div className="w-full md:w-48 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Building2 className="w-4 h-4 text-gray-400" />
            </div>
            <select 
              value={orgId} 
              onChange={(e) => setOrgId(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-white/50 border-transparent hover:bg-white focus:bg-white focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all rounded-xl text-sm outline-none appearance-none cursor-pointer text-gray-700 font-medium"
            >
              <option value="" disabled>Select Organization</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button 
              onClick={() => { loadOrgs(); loadData(); }}
              className="p-2.5 bg-white/50 hover:bg-white text-gray-500 hover:text-indigo-600 rounded-xl transition-all border border-transparent hover:border-indigo-100 hover:shadow-sm"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <ExportMenu onExport={handleExport} isExporting={isExporting} />

            <button 
              onClick={()=>setCreateOpen(true)}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Add Dept</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl overflow-hidden shadow-sm">
            {loading ? (
                <div className="p-8 space-y-4">
                    {[...Array(3)].map((_,i) => (
                        <div key={i} className="h-20 bg-gray-100/50 rounded-xl animate-pulse"></div>
                    ))}
                </div>
            ) : filteredDepts.length === 0 ? (
                <div className="p-16 text-center text-slate-400">
                  <div className="w-16 h-16 mx-auto mb-4 bg-indigo-50 rounded-full flex items-center justify-center">
                    <Layers className="w-8 h-8 text-indigo-300" />
                  </div>
                  <div className="font-medium text-slate-600 text-lg">No departments found</div>
                  <div className="text-sm text-slate-400 mt-1">Create a new department to get started.</div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                    {filteredDepts.map(d => (
                        <div key={d.id} className="bg-white border border-indigo-100/50 rounded-xl p-5 hover:shadow-md transition-all group relative">
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <div className="relative">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === d.id ? '' : d.id); }}
                                        className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        <MoreVertical className="w-4 h-4" />
                                    </button>
                                    
                                    {openMenuId === d.id && (
                                        <div className="absolute top-full right-0 mt-1 w-32 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-20">
                                            <button 
                                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                                onClick={() => { setEditDept(d); setNewName(d.name); setOpenMenuId(''); }}
                                            >
                                                <Edit2 className="w-3.5 h-3.5" /> Rename
                                            </button>
                                            <button 
                                                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                onClick={() => { del(d.id); setOpenMenuId(''); }}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" /> Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <h3 className="text-lg font-semibold text-gray-800 mb-1">{d.name}</h3>
                            <div className="flex items-center gap-4 text-sm text-gray-500 mt-4">
                                <div className="flex items-center gap-1.5">
                                    <Users className="w-4 h-4 text-gray-400" />
                                    <span>{membersCount(d.id)} Members</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    <span>{new Date(d.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* Create Modal */}
      <GlassModal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Department" hideClose={true}>
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department Name</label>
                <input 
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                    placeholder="e.g. Engineering"
                />
            </div>
            <div className="pt-4 flex justify-end gap-3">
                <button 
                    onClick={() => setCreateOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={create}
                    disabled={!newName.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:shadow-none"
                >
                    Create Department
                </button>
            </div>
        </div>
      </GlassModal>

      {/* Rename Modal */}
      <GlassModal open={!!editDept} onClose={() => { setEditDept(null); setNewName(''); }} title="Rename Department" hideClose={true}>
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department Name</label>
                <input 
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                    placeholder="e.g. Engineering"
                />
            </div>
            <div className="pt-4 flex justify-end gap-3">
                <button 
                    onClick={() => { setEditDept(null); setNewName(''); }}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={rename}
                    disabled={!newName.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:shadow-none"
                >
                    Save Changes
                </button>
            </div>
        </div>
      </GlassModal>

      <Toast message={toast.m} type={toast.t} />
    </AppShell>
  )
}
