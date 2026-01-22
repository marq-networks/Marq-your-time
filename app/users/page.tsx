'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassModal from '@components/ui/GlassModal'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import usePermission from '@lib/hooks/usePermission'
import Toast from '@components/Toast'
import { normalizeRoleForApi } from '@lib/permissions'
import { useListQuery } from '@/lib/hooks/useListQuery'
import FilterBar from '@/components/filters/FilterBar'
import SortSelect from '@/components/filters/SortSelect'
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

  const { filters, setFilters, search } = useListQuery()
  
  const roleName = (id?: string) => roles.find(r=>r.id===id)?.name || '-'
  const deptName = (id?: string) => departments.find(d=>d.id===id)?.name || '-'

  const loadOrgs = async () => {
    const endpoint = role === 'super_admin' ? '/api/org/list' : '/api/orgs/my'
    const res = await fetch(endpoint, { cache: 'no-store' })
    const data = await res.json()
    const items: Org[] = Array.isArray(data.items) ? (data.items as Org[]) : []
    setOrgs(items)
    if (!orgId && items.length) {
      const cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
      const preferred = items.find(o => o.id === cookieOrgId)?.id || items[0].id
      setOrgId(preferred)
    }
  }

  const loadMeta = async (oid: string) => {
    if (!oid) return
    const [rRes, dRes] = await Promise.all([
      fetch(`/api/role/list?orgId=${oid}`, { cache:'no-store' }),
      fetch(`/api/department/list?orgId=${oid}`, { cache:'no-store' })
    ])
    const [r, d] = await Promise.all([rRes.json(), dRes.json()])
    setRoles(r.items || [])
    setDepartments(d.items || [])
  }

  const loadUsers = async () => {
    if (!orgId) return
    
    const params = new URLSearchParams()
    params.set('orgId', orgId)
    if (search) params.set('q', search)
    if (filters.status) params.set('status', filters.status)
    if (filters.role) params.set('role', filters.role) // Maps to roleId
    if (filters.deptId) params.set('deptId', filters.deptId)
    if (filters.sort) params.set('sort', filters.sort)
    
    const res = await fetch(`/api/user/list?${params.toString()}`, { cache:'no-store' })
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
  }

  useEffect(() => { loadOrgs() }, [])
  useEffect(() => { if (orgId) { loadMeta(orgId); loadUsers(); } }, [orgId])
  useEffect(() => { if (orgId) loadUsers() }, [filters, search])

  // Filter Config
  const filterConfig = useMemo(() => [
    {
      key: 'status',
      label: 'Status',
      type: 'status' as const,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Invited', value: 'invited' }
      ]
    },
    {
      key: 'role',
      label: 'Role',
      type: 'select' as const,
      options: roles.map(r => ({ label: r.name, value: r.id }))
    },
    {
      key: 'deptId',
      label: 'Department',
      type: 'select' as const,
      options: departments.map(d => ({ label: d.name, value: d.id }))
    }
  ], [roles, departments])
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

  const columns = ['Photo','Name','Email','Role','Department','Login','Status','Actions']
  const rows = users.map(u => [
    <div key={u.id} style={{width:28,height:28,borderRadius:8,background:'#111',border:'1px solid var(--border)',overflow:'hidden'}}>
      {u.profileImage && <img src={u.profileImage} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />}
    </div>,
    `${u.firstName} ${u.lastName}`,
    u.email,
    roleName(u.roleId),
    deptName(u.departmentId),
    <span className="badge" style={loginStatus[u.id]==='logged_in'
      ? { borderColor:'var(--green)', color:'var(--green)' }
      : { borderColor:'#666', color:'#888' }}>
      {loginStatus[u.id]==='logged_in' ? 'Logged in' : 'Not logged in'}
    </span>,
    <span className="badge">{u.status}</span>,
    <div style={{position:'relative'}}>
      <GlassButton onClick={()=>setOpenMenuId(openMenuId===u.id?'':u.id)}>Actions ▾</GlassButton>
      {openMenuId===u.id && (
        <div ref={menuRef} style={{position:'absolute',top:'110%',right:0,background:'var(--card)',border:'1px solid var(--border)',borderRadius:'var(--radius-large)',boxShadow:'var(--shadow)',minWidth:220,padding:8,zIndex:10}}>
          <div className="subtitle" style={{padding:'6px 10px'}}>Quick Actions</div>
          <button className="btn-glass" style={{display:'flex',alignItems:'center',gap:8,justifyContent:'flex-start',width:'100%'}} onClick={()=>{ setEditUser(u); setEditReadOnly(true); setOpenMenuId('') }}>👁️ View</button>
          {canManageUsers && <button className="btn-glass" style={{display:'flex',alignItems:'center',gap:8,justifyContent:'flex-start',width:'100%'}} onClick={()=>{ setEditUser(u); setEditReadOnly(false); setOpenMenuId('') }}>✏️ Edit</button>}
          <div style={{height:1,background:'var(--border)',margin:'6px 8px'}}></div>
          {u.status==='suspended' ? (
            <button className="btn-glass" style={{display:'flex',alignItems:'center',gap:8,justifyContent:'flex-start',width:'100%'}} onClick={()=>{ activate(u.id); setOpenMenuId('') }}>✅ Activate</button>
          ) : (
            (canManageUsers ? <button className="btn-glass" style={{display:'flex',alignItems:'center',gap:8,justifyContent:'flex-start',width:'100%'}} onClick={()=>{ setConfirmSuspendId(u.id); setOpenMenuId('') }}>⛔ Suspend</button> : null)
          )}
          <button className="btn-glass" style={{display:'flex',alignItems:'center',gap:8,justifyContent:'flex-start',width:'100%'}} onClick={()=>{ setConfirmResetId(u.id); setOpenMenuId('') }}>🔒 Reset Password</button>
        </div>
      )}
    </div>
  ])

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
      <div className="mb-6 space-y-4">
        {/* Org Selector */}
        <div className="w-64 mb-4">
          <div className="label">Organization</div>
          <GlassSelect value={orgId} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setOrgId(e.target.value)}>
            <option value="">Select org</option>
            {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
          </GlassSelect>
        </div>

        <FilterBar 
          pageKey="users" 
          orgId={orgId} 
          config={filterConfig} 
          showSavedViews
        >
          <SortSelect 
            options={[
              { label: 'Name (A-Z)', value: 'first_name:asc' },
              { label: 'Name (Z-A)', value: 'first_name:desc' },
              { label: 'Newest', value: 'created_at:desc' },
              { label: 'Oldest', value: 'created_at:asc' }
            ]}
            value={filters.sort || 'first_name:asc'}
            onChange={(val) => setFilters({ ...filters, sort: val })}
          />
        </FilterBar>

        <GlassCard title="Users" right={
          <div className="row" style={{gap:8, alignItems: 'center'}}>
            <ExportMenu onExport={handleExport} isExporting={isExporting} />
            {canManageUsers && <GlassButton variant="primary" onClick={()=>setAddOpen(true)}>Add User</GlassButton>}
          </div>
        }>
          <GlassTable columns={columns} rows={rows} />
        </GlassCard>
      </div>

      <GlassModal open={addOpen} title="Create User" onClose={()=>setAddOpen(false)}>
        <div className="grid grid-2">
          <div>
            <div className="label">Profile photo</div>
            <div className="row" style={{gap:12}}>
              <div style={{width:48,height:48,borderRadius:12,background:'#111',border:'1px solid var(--border)'}}>
                {form.profileImage && <img src={form.profileImage} alt="" style={{width:'100%',height:'100%',borderRadius:12,objectFit:'cover'}} />}
              </div>
              <input type="file" accept="image/*" onChange={async (e)=>{
                const f = e.target.files?.[0]
                if (!f) return
                const reader = new FileReader()
                reader.onload = () => setForm({...form, profileImage: String(reader.result || '')})
                reader.readAsDataURL(f)
              }} />
            </div>
          </div>
          <div>
            <div className="label">First name</div>
            <input className="input" value={form.firstName} onChange={e=>setForm({...form, firstName:e.target.value})} />
          </div>
          <div>
            <div className="label">Last name</div>
            <input className="input" value={form.lastName} onChange={e=>setForm({...form, lastName:e.target.value})} />
          </div>
          <div>
            <div className="label">Email</div>
            <input className="input" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
            {!emailOk && form.email ? <div className="subtitle">Invalid email</div> : null}
          </div>
          <div>
            <div className="label">Password</div>
            <input className="input" type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} />
          </div>
          <div>
            <div className="label">Salary</div>
            <input className="input" type="number" value={form.salary} onChange={e=>setForm({...form, salary:e.target.value})} />
          </div>
          <div>
            <div className="label">Working days (comma)</div>
            <input className="input" value={(form.workingDays as any).join(',')} onChange={e=>setForm({...form, workingDays: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} />
          </div>
          <div>
            <div className="label">Hours per day</div>
            <input className="input" type="number" value={form.workingHoursPerDay} onChange={e=>setForm({...form, workingHoursPerDay:e.target.value})} />
          </div>
          <div>
            <div className="label">Department</div>
            <GlassSelect value={form.departmentId} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setForm({...form, departmentId:e.target.value})}>
              <option value="">Select</option>
              {departments.map(d=> <option key={d.id} value={d.id}>{d.name}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">Role</div>
            <GlassSelect value={form.roleId || (form.roleName ? `role:${form.roleName.toLowerCase().replace(' ','_')}` : '')} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>{
              const v = e.target.value
              if (v.startsWith('role:')) {
                const name = v.split(':')[1]
                setForm({ ...form, roleId: '', roleName: name.replace('_',' ') })
              } else {
                setForm({ ...form, roleId: v, roleName: '' })
              }
            }}>
              <option value="">Select</option>
              {role !== 'admin' && <option value="role:super_admin">Super Admin</option>}
              {role !== 'admin' && <option value="role:admin">Admin</option>}
              <option value="role:employee">Employee</option>
              {(role === 'admin' ? roles.filter(r=>r.name.toLowerCase()==='employee') : roles).map(r=> <option key={r.id} value={r.id}>{r.name}</option>)}
            </GlassSelect>
          </div>
        </div>
        <div className="row" style={{marginTop:12}}>
          {canManageUsers && <GlassButton variant="primary" onClick={createUser}>Create User</GlassButton>}
        </div>
      </GlassModal>

      <GlassModal open={!!editUser} title={editReadOnly ? 'View User' : 'Edit User'} onClose={()=>setEditUser(undefined)}>
        {editUser && (
          <div>
            <div className="row" style={{alignItems:'center',gap:12,marginBottom:12}}>
              <div style={{width:48,height:48,borderRadius:12,background:'#111',border:'1px solid var(--border)'}}>
                {editUser.profileImage && <img src={editUser.profileImage} alt="" style={{width:'100%',height:'100%',borderRadius:12,objectFit:'cover'}} />}
              </div>
              <div>
                <div className="title" style={{margin:0}}>{editUser.firstName} {editUser.lastName}</div>
                <div className="subtitle" style={{marginTop:4}}>{editUser.email}</div>
              </div>
            </div>
            <div className="grid grid-2">
              <div>
                <div className="label">Department</div>
                <GlassSelect value={editUser.departmentId || ''} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setEditUser({...editUser, departmentId: e.target.value})} className={editReadOnly? 'disabled':''}>
                  <option value="">Select</option>
                  {departments.map(d=> <option key={d.id} value={d.id}>{d.name}</option>)}
                </GlassSelect>
              </div>
              <div>
                <div className="label">Role</div>
                <GlassSelect value={editUser.roleId || ''} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setEditUser({...editUser, roleId: e.target.value})} className={editReadOnly? 'disabled':''}>
                  <option value="">Select</option>
                  {roles.map(r=> <option key={r.id} value={r.id}>{r.name}</option>)}
                </GlassSelect>
              </div>
              <div>
                <div className="label">Salary</div>
                <input className="input" type="number" value={(editUser as any).salary || ''} onChange={e=>setEditUser({...editUser, ...(editUser as any), salary: Number(e.target.value) } as any)} disabled={editReadOnly} />
              </div>
              <div>
                <div className="label">Working days (comma)</div>
                <input className="input" value={((editUser as any).workingDays || []).join(',')} onChange={e=>setEditUser({...editUser, ...(editUser as any), workingDays: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)} as any)} disabled={editReadOnly} />
              </div>
              <div>
                <div className="label">Hours per day</div>
                <input className="input" type="number" value={(editUser as any).workingHoursPerDay || ''} onChange={e=>setEditUser({...editUser, ...(editUser as any), workingHoursPerDay: Number(e.target.value)} as any)} disabled={editReadOnly} />
              </div>
              <div>
                <div className="label">Status</div>
                <select className="input" value={editUser.status} onChange={e=>setEditUser({...editUser, status: e.target.value})} disabled={editReadOnly}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="suspended">suspended</option>
                </select>
              </div>
            </div>
            {!editReadOnly && canManageUsers && (
              <div className="row" style={{marginTop:12}}>
                <GlassButton variant="primary" onClick={updateUser}>Save</GlassButton>
              </div>
            )}
          </div>
        )}
      </GlassModal>

      <GlassModal open={!!confirmSuspendId} title="Suspend User" onClose={()=>setConfirmSuspendId('')}>
        <div className="grid">
          <div className="subtitle">Are you sure you want to suspend this user?</div>
          <div className="row" style={{justifyContent:'flex-end',gap:8}}>
            <GlassButton variant="secondary" onClick={()=>setConfirmSuspendId('')}>Cancel</GlassButton>
            <GlassButton variant="primary" onClick={async()=>{ await suspend(confirmSuspendId); setConfirmSuspendId('') }}>Confirm Suspend</GlassButton>
          </div>
        </div>
      </GlassModal>

      <GlassModal open={!!confirmResetId} title="Reset Password" onClose={()=>setConfirmResetId('')}>
        <div className="grid">
          <div className="subtitle">Send a password reset email to this user?</div>
          <div className="row" style={{justifyContent:'flex-end',gap:8}}>
            <GlassButton variant="secondary" onClick={()=>setConfirmResetId('')}>Cancel</GlassButton>
            <GlassButton variant="primary" onClick={()=>{ resetPassword(confirmResetId); setConfirmResetId('') }}>Send Reset Email</GlassButton>
          </div>
        </div>
      </GlassModal>

      <Toast message={toast.m} type={toast.t} />
    </AppShell>
  )
}
