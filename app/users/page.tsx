'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Search, Filter, Plus, ChevronDown, UserPlus, Users, Activity, Clock, Shield, Briefcase, Mail, Building2, Download, RefreshCw } from 'lucide-react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassModal from '@components/ui/GlassModal'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import usePermission from '@lib/hooks/usePermission'
import Toast from '@components/Toast'
import { normalizeRoleForApi } from '@lib/permissions'
import { useListQuery } from '@/lib/hooks/useListQuery'
import ExportMenu from '@/components/shared/ExportMenu'
import { exportToCsv, exportToPdf, type ExportColumn } from '@/lib/export-utils'

type Org = { id: string, orgName: string }
type Department = { id: string, name: string }
type Role = { id: string, name: string }
type User = { id: string, firstName: string, lastName: string, email: string, profileImage?: string, roleId?: string, departmentId?: string, status: string }

export default function UsersPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState<string>('')
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [toast, setToast] = useState<{m?:string,t?:'success'|'error'}>({})
  const [addOpen, setAddOpen] = useState(false)
  const [editUser, setEditUser] = useState<User|undefined>(undefined)
  const [editReadOnly, setEditReadOnly] = useState<boolean>(false)
  const [openMenuId, setOpenMenuId] = useState<string>('')
  const menuRef = useRef<HTMLDivElement|null>(null)
  const [confirmSuspendId, setConfirmSuspendId] = useState<string>('')
  const [confirmResetId, setConfirmResetId] = useState<string>('')
  const canManageUsers = usePermission('manage_users').allowed
  const role = typeof document !== 'undefined' ? normalizeRoleForApi(document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''
  const [loginStatus, setLoginStatus] = useState<Record<string,'logged_in'|'not_logged_in'>>({})
  const [isExporting, setIsExporting] = useState(false)
  const [loading, setLoading] = useState(true)

  const { filters, setFilters, search, setSearch } = useListQuery()
  
  const roleName = (id?: string) => roles.find(r=>r.id===id)?.name || '-'
  const deptName = (id?: string) => departments.find(d=>d.id===id)?.name || '-'

  const loadOrgs = async () => {
    try {
      const endpoint = role === 'super_admin' ? '/api/org/list' : '/api/orgs/my'
      const res = await fetch(endpoint, { cache: 'no-store' })
      const data = await res.json()
      const items: Org[] = Array.isArray(data.items) ? (data.items as Org[]) : []
      setOrgs(items)
      
      // Auto-select organization
      const cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
      
      if (!orgId) {
        if (items.length) {
          const preferred = items.find(o => o.id === cookieOrgId)?.id || items[0].id
          setOrgId(preferred)
        } else if (cookieOrgId) {
          // Fallback: If API returns empty but we have a cookie, try using it
          // This handles cases where list endpoint might be failing or empty but user has access
          console.warn('Orgs list empty, using cookie org ID fallback')
          setOrgId(cookieOrgId)
          // Also try to reconstruct a dummy org object so the selector isn't empty
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

  const loadMeta = async (oid: string) => {
    if (!oid) return
    try {
      const [rRes, dRes] = await Promise.all([
        fetch(`/api/role/list?orgId=${oid}`, { cache:'no-store' }),
        fetch(`/api/department/list?orgId=${oid}`, { cache:'no-store' })
      ])
      const [r, d] = await Promise.all([rRes.json(), dRes.json()])
      setRoles(r.items || [])
      setDepartments(d.items || [])
    } catch (e) {
      console.error('Failed to load meta', e)
    }
  }

  const loadUsers = async () => {
    if (!orgId) return
    setLoading(true)
    
    try {
      const params = new URLSearchParams()
      params.set('orgId', orgId)
      if (search) params.set('q', search)
      if (filters.status) params.set('status', filters.status)
      if (filters.role) params.set('role', filters.role) // Maps to roleId
      if (filters.deptId) params.set('deptId', filters.deptId)
      if (filters.sort) params.set('sort', filters.sort)
      
      const res = await fetch(`/api/user/list?${params.toString()}`, { cache:'no-store' })
      if (!res.ok) throw new Error('Failed to fetch users')
      
      const u = await res.json()
      const userItems: User[] = u.items || []
      setUsers(userItems)
      
      // Login status check
      const statusMap: Record<string,'logged_in'|'not_logged_in'> = {}
      await Promise.all(userItems.map(async (user) => {
        try {
          const res = await fetch(`/api/time/today?member_id=${user.id}&org_id=${orgId}`, { cache: 'no-store' })
          if (!res.ok) {
            statusMap[user.id] = 'not_logged_in'
            return
          }
          const data = await res.json()
          const open = !!data.session_open || !!data.attendance?.hasOpenSession
          statusMap[user.id] = open ? 'logged_in' : 'not_logged_in'
        } catch {
          statusMap[user.id] = 'not_logged_in'
        }
      }))
      setLoginStatus(statusMap)
    } catch (e) {
      console.error('Failed to load users', e)
      setToast({ m: 'Failed to load users. Please try refreshing.', t: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOrgs() }, [])
  useEffect(() => { if (orgId) { loadMeta(orgId); loadUsers(); } }, [orgId])
  useEffect(() => { if (orgId) loadUsers() }, [filters, search])

  useEffect(() => {
    const closeOnOutside = (e: MouseEvent) => {
      if (!openMenuId) return
      const el = menuRef.current
      if (el && !el.contains(e.target as Node)) setOpenMenuId('')
    }
    document.addEventListener('mousedown', closeOnOutside)
    return () => document.removeEventListener('mousedown', closeOnOutside)
  }, [openMenuId])

  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', password:'', salary:'', workingDays: [] as string[], workingHoursPerDay: '', departmentId:'', roleId:'', roleName:'', profileImage:'' })
  const emailOk = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email), [form.email])

  const createUser = async () => {
    if (!orgId) { setToast({ m:'Select organization', t:'error' }); return }
    const req = {
      ...form,
      orgId,
      salary: Number(form.salary),
      workingHoursPerDay: Number(form.workingHoursPerDay)
    }
    const res = await fetch('/api/user/create', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(req) })
    const data = await res.json()
    if (res.ok) { setAddOpen(false); setToast({ m:'User created', t:'success' }); setForm({ firstName:'', lastName:'', email:'', password:'', salary:'', workingDays: [], workingHoursPerDay: '', departmentId:'', roleId:'', roleName:'', profileImage:'' }); loadUsers() }
    else setToast({ m: data.error || 'Error', t:'error' })
  }

  const suspend = async (id: string) => {
    const res = await fetch(`/api/user/${id}/suspend`, { method:'POST' })
    const data = await res.json()
    if (res.ok) { setToast({ m:'User suspended', t:'success' }); loadUsers() }
    else setToast({ m: data.error || 'Error', t:'error' })
  }

  const activate = async (id: string) => {
    const res = await fetch(`/api/user/${id}/activate`, { method:'POST' })
    const data = await res.json()
    if (res.ok) { setToast({ m:'User activated', t:'success' }); loadUsers() }
    else setToast({ m: data.error || 'Error', t:'error' })
  }

  const resetPassword = async (_id: string) => {
    setToast({ m:'Password reset email queued', t:'success' })
  }

  const updateUser = async () => {
    if (!editUser) return
    const payload = {
      departmentId: editUser.departmentId,
      roleId: editUser.roleId,
      salary: (editUser as any).salary,
      workingDays: (editUser as any).workingDays,
      workingHoursPerDay: (editUser as any).workingHoursPerDay,
      status: editUser.status
    }
    const res = await fetch(`/api/user/${editUser.id}/update`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    const data = await res.json()
    if (res.ok) { setToast({ m:'User updated', t:'success' }); setEditUser(undefined); loadUsers() }
    else setToast({ m: data.error || 'Error', t:'error' })
  }

  const handleExport = async (type: 'csv' | 'pdf') => {
    if (!orgId) return
    setIsExporting(true)
    try {
      const params = new URLSearchParams()
      params.set('orgId', orgId)
      if (search) params.set('q', search)
      if (filters.status) params.set('status', filters.status)
      if (filters.role) params.set('role', filters.role)
      if (filters.deptId) params.set('deptId', filters.deptId)
      if (filters.sort) params.set('sort', filters.sort)
      
      const res = await fetch(`/api/user/list?${params.toString()}`, { cache:'no-store' })
      const u = await res.json()
      const exportItems: User[] = u.items || []

      if (exportItems.length === 0) {
        alert('No data to export')
        return
      }

      const exportColumns: ExportColumn[] = [
        { header: 'Name', accessor: (u) => `${u.firstName} ${u.lastName}` },
        { header: 'Email', accessor: 'email' },
        { header: 'Role', accessor: (u) => roleName(u.roleId) },
        { header: 'Department', accessor: (u) => deptName(u.departmentId) },
        { header: 'Status', accessor: 'status' },
      ]

      const filename = `marq_users_${new Date().toISOString().split('T')[0]}`

      if (type === 'csv') {
        exportToCsv(exportItems, exportColumns, filename)
      } else {
        exportToPdf(exportItems, exportColumns, 'Users', filename)
      }
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <AppShell title="Users">
      <div className="mb-6 space-y-6">
        
        {/* Modern Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="relative overflow-hidden bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl p-6 shadow-sm group hover:shadow-md transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Total Users</div>
                  <div className="text-2xl font-bold text-gray-800">{users.length}</div>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl p-6 shadow-sm group hover:shadow-md transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Active Members</div>
                  <div className="text-2xl font-bold text-gray-800">{users.filter(u=>u.status==='active').length}</div>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl p-6 shadow-sm group hover:shadow-md transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Online Today</div>
                  <div className="text-2xl font-bold text-gray-800">{Object.values(loginStatus).filter(s=>s==='logged_in').length}</div>
                </div>
              </div>
            </div>
        </div>

        {/* Integrated Filter Bar */}
        <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl p-2 shadow-sm flex flex-col md:flex-row items-center gap-3">
          
          {/* Search */}
          <div className="flex-1 w-full md:w-auto relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search users..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white/50 border-transparent focus:bg-white focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all rounded-xl text-sm outline-none placeholder:text-gray-400"
            />
          </div>

          <div className="w-px h-8 bg-gray-200 hidden md:block"></div>

          {/* Org Selector (Integrated) */}
          <div className="w-full md:w-48 relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Building2 className="w-4 h-4 text-gray-400" />
            </div>
            <select 
              value={orgId} 
              onChange={(e) => setOrgId(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-white/50 border-transparent hover:bg-white focus:bg-white focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all rounded-xl text-sm outline-none appearance-none cursor-pointer text-gray-700 font-medium"
            >
              <option value="" disabled>Select Organization</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Filters Dropdown (Simplified) */}
          <div className="w-full md:w-40 relative">
             <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <Filter className="w-4 h-4 text-gray-400" />
            </div>
            <select 
              value={filters.status || ''} 
              onChange={(e) => setFilters({...filters, status: e.target.value || null})}
              className="w-full pl-9 pr-8 py-2.5 bg-white/50 border-transparent hover:bg-white focus:bg-white focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all rounded-xl text-sm outline-none appearance-none cursor-pointer text-gray-700"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="invited">Invited</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
             {/* Refresh Button */}
            <button 
              onClick={() => { loadOrgs(); loadUsers(); }}
              className="p-2.5 bg-white/50 hover:bg-white text-gray-500 hover:text-emerald-600 rounded-xl transition-all border border-transparent hover:border-emerald-100 hover:shadow-sm"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Export */}
            <ExportMenu onExport={handleExport} isExporting={isExporting} />

            {/* Add User */}
            {canManageUsers && (
              <button 
                onClick={()=>setAddOpen(true)}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 active:scale-95 whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add User</span>
              </button>
            )}
          </div>
        </div>

        {/* List Card */}
        <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl overflow-hidden shadow-sm">
           {/* Custom List Header */}
           <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-100/50 bg-gray-50/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <div className="col-span-4 pl-2">User</div>
              <div className="col-span-2">Role</div>
              <div className="col-span-2">Department</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-right pr-4">Actions</div>
           </div>
           
           {/* List Items */}
           <div className="divide-y divide-gray-100/50">
             {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-12 gap-4 p-4 border-b border-indigo-100/50 animate-pulse">
                     <div className="col-span-4 flex items-center gap-3 pl-2">
                       <div className="w-10 h-10 bg-indigo-100/50 rounded-xl"></div>
                       <div className="space-y-2">
                         <div className="h-4 w-32 bg-indigo-100/50 rounded"></div>
                         <div className="h-3 w-24 bg-indigo-50/50 rounded"></div>
                       </div>
                     </div>
                     <div className="col-span-2"><div className="h-5 w-20 bg-indigo-50/50 rounded-full"></div></div>
                     <div className="col-span-2"><div className="h-4 w-24 bg-indigo-50/50 rounded"></div></div>
                     <div className="col-span-2"><div className="h-5 w-16 bg-indigo-50/50 rounded-full"></div></div>
                     <div className="col-span-2"></div>
                  </div>
                ))
             ) : users.length === 0 ? (
                <div className="p-16 text-center text-slate-400">
                  <div className="w-16 h-16 mx-auto mb-4 bg-indigo-50 rounded-full flex items-center justify-center">
                    <Users className="w-8 h-8 text-indigo-300" />
                  </div>
                  <div className="font-medium text-slate-600 text-lg">No users found</div>
                  <div className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">
                    {(search || filters.status || filters.role || filters.deptId) 
                      ? "Try adjusting your search or filters to find who you're looking for." 
                      : "Get started by adding your first team member."}
                  </div>
                </div>
             ) : (
             users.map(u => (
               <div key={u.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-white/60 transition-colors group">
                  <div className="col-span-4 flex items-center gap-3 pl-2">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                        {u.profileImage ? (
                          <img src={u.profileImage} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-gray-400 font-bold text-lg">{u.firstName[0]}</span>
                        )}
                      </div>
                      {loginStatus[u.id]==='logged_in' && (
                        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></div>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{u.firstName} {u.lastName}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </div>
                  </div>
                  
                  <div className="col-span-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                      {roleName(u.roleId)}
                    </span>
                  </div>
                  
                  <div className="col-span-2 text-sm text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                      {deptName(u.departmentId)}
                    </div>
                  </div>
                  
                  <div className="col-span-2">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      u.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 
                      u.status === 'suspended' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        u.status === 'active' ? 'bg-emerald-500' : 
                        u.status === 'suspended' ? 'bg-red-500' : 'bg-amber-500'
                      }`}></div>
                      <span className="capitalize">{u.status}</span>
                    </div>
                  </div>
                  
                  <div className="col-span-2 flex justify-end pr-2 relative">
                    <button 
                      onClick={()=>setOpenMenuId(openMenuId===u.id?'':u.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <span className="text-lg leading-none">•••</span>
                    </button>
                    
                    {openMenuId===u.id && (
                      <div ref={menuRef} className="absolute top-full right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-20 animate-in fade-in zoom-in-95 duration-100">
                        <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</div>
                        
                        <Link href={`/users/${u.id}`} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2" onClick={() => setOpenMenuId('')}>
                          <Users className="w-4 h-4" /> View Details
                        </Link>
                        
                        {canManageUsers && (
                          <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2" onClick={()=>{ setEditUser(u); setEditReadOnly(false); setOpenMenuId('') }}>
                            <Briefcase className="w-4 h-4" /> Edit User
                          </button>
                        )}
                        
                        <div className="h-px bg-gray-100 my-1"></div>
                        
                        {u.status==='suspended' ? (
                          <button className="w-full text-left px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 flex items-center gap-2" onClick={()=>{ activate(u.id); setOpenMenuId('') }}>
                            <Shield className="w-4 h-4" /> Activate Account
                          </button>
                        ) : (
                          canManageUsers && (
                            <button className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2" onClick={()=>{ setConfirmSuspendId(u.id); setOpenMenuId('') }}>
                              <Shield className="w-4 h-4" /> Suspend Account
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
               </div>
             )))}
           </div>
        </div>

        {/* Modals - Keeping existing structure but using GlassModal */}
        <GlassModal open={addOpen} onClose={()=>setAddOpen(false)} title="Add New User">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input className="w-full p-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none" value={form.firstName} onChange={e=>setForm({...form, firstName:e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input className="w-full p-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none" value={form.lastName} onChange={e=>setForm({...form, lastName:e.target.value})} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input className="w-full p-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input className="w-full p-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none" type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select className="w-full p-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white" value={form.roleId} onChange={e=>setForm({...form, roleId:e.target.value})}>
                  <option value="">Select Role</option>
                  {roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select className="w-full p-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white" value={form.departmentId} onChange={e=>setForm({...form, departmentId:e.target.value})}>
                  <option value="">Select Dept</option>
                  {departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
            <div className="pt-4 flex justify-end gap-3">
              <button onClick={()=>setAddOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
              <button onClick={createUser} disabled={!form.firstName || !form.lastName || !emailOk || !form.password || !form.roleId} className="px-6 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition-colors font-medium shadow-lg shadow-emerald-500/20">Create User</button>
            </div>
          </div>
        </GlassModal>

        {/* Edit Modal */}
        {editUser && (
          <GlassModal open={!!editUser} onClose={()=>setEditUser(undefined)} title={editReadOnly ? "User Details" : "Edit User"}>
             <div className="space-y-4">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-400">
                    {editUser.profileImage ? <img src={editUser.profileImage} className="w-full h-full object-cover rounded-2xl" /> : editUser.firstName[0]}
                  </div>
                  <div>
                    <div className="text-xl font-bold text-gray-800">{editUser.firstName} {editUser.lastName}</div>
                    <div className="text-gray-500">{editUser.email}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select disabled={editReadOnly} className="w-full p-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white disabled:bg-gray-50" value={editUser.roleId} onChange={e=>setEditUser({...editUser, roleId:e.target.value})}>
                      {roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                    <select disabled={editReadOnly} className="w-full p-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white disabled:bg-gray-50" value={editUser.departmentId} onChange={e=>setEditUser({...editUser, departmentId:e.target.value})}>
                      {departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>

                {!editReadOnly && (
                  <div className="pt-4 flex justify-end gap-3">
                    <button onClick={()=>setEditUser(undefined)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                    <button onClick={updateUser} className="px-6 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-medium shadow-lg shadow-emerald-500/20">Save Changes</button>
                  </div>
                )}
             </div>
          </GlassModal>
        )}

        <Toast message={toast.m} type={toast.t} />
      </div>
    </AppShell>
  )
}
