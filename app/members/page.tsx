'use client'

import { useEffect, useState, useMemo } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import { useListQuery } from '@/lib/hooks/useListQuery'
import FilterBar from '@/components/filters/FilterBar'
import SortSelect from '@/components/filters/SortSelect'
import { normalizeRoleForApi } from '@lib/permissions'
import ExportMenu from '@/components/shared/ExportMenu'
import { exportToCsv, exportToPdf, ExportColumn } from '@/lib/export-utils'

type Org = { id: string, orgName: string }
type Department = { id: string, name: string }
type Role = { id: string, name: string }
type User = { id: string, firstName: string, lastName: string, email: string, profileImage?: string, roleId?: string, departmentId?: string, status: string }

export default function MembersPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState<string>('')
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [role, setRole] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const { filters, setFilters, search, updateFilter } = useListQuery()

  // Initial Auth & Role Setup
  useEffect(()=>{ 
    try { 
      const r = normalizeRoleForApi((typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''))
      setRole(r)
    } catch {} 
  }, [])

  const loadOrgs = async () => {
    const endpoint = role === 'super_admin' ? '/api/org/list' : '/api/orgs/my'
    const res = await fetch(endpoint, { cache: 'no-store' })
    const data = await res.json()
    const items: Org[] = Array.isArray(data.items) ? (data.items as Org[]) : []
    setOrgs(items)
    
    // Sync orgId with URL or default
    if (filters.orgId) {
      setOrgId(filters.orgId)
    } else if (items.length) {
      const cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
      const preferred = items.find(o => o.id === cookieOrgId)?.id || items[0].id
      setOrgId(preferred)
      updateFilter('orgId', preferred)
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
    if (filters.role) params.set('role', filters.role)
    if (filters.deptId) params.set('deptId', filters.deptId)
    if (filters.sort) params.set('sort', filters.sort)
    
    const res = await fetch(`/api/user/list?${params.toString()}`, { cache:'no-store' })
    const u = await res.json()
    setUsers(u.items || [])
  }

  useEffect(() => { if(role) loadOrgs() }, [role])
  useEffect(() => { if(orgId) loadMeta(orgId) }, [orgId])
  useEffect(() => { loadUsers() }, [orgId, search, filters])

  const roleName = (id?: string) => roles.find(r=>r.id===id)?.name || '-'
  const deptName = (id?: string) => departments.find(d=>d.id===id)?.name || '-'

  const handleExport = async (type: 'csv' | 'pdf') => {
    if (!orgId) return
    setIsExporting(true)
    try {
        // Use current users state as it seems to be the full list (or at least what is displayed)
        const exportItems = users 
        
        const exportColumns: ExportColumn[] = [
            { header: 'Name', accessor: (u) => `${u.firstName} ${u.lastName}` },
            { header: 'Email', accessor: 'email' },
            { header: 'Role', accessor: (u) => roleName(u.roleId) },
            { header: 'Department', accessor: (u) => deptName(u.departmentId) },
            { header: 'Status', accessor: 'status' },
        ]

        const filename = `marq_members_${new Date().toISOString().split('T')[0]}`
        if (type === 'csv') exportToCsv(exportItems, exportColumns, filename)
        else exportToPdf(exportItems, exportColumns, 'Members Directory', filename)

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
      type: 'select' as const, 
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Pending', value: 'pending' }
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

  const columns = ['Name', 'Email', 'Role', 'Department', 'Status', 'Actions']
  const rows = users.map(user => [
    <div className="row" style={{ gap: 8 }}>
      {user.profileImage && <img src={user.profileImage} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />}
      <span>{user.firstName} {user.lastName}</span>
    </div>,
    user.email,
    <span className="tag-pill">{roleName(user.roleId)}</span>,
    deptName(user.departmentId),
    <span className={`status-badge ${user.status}`}>{user.status}</span>,
    <GlassButton variant="secondary" href={`/members/${user.id}/structure`}>View</GlassButton>
  ])

  return (
    <AppShell title="Members">
      <GlassCard title="Members Directory">
        <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
          <div className="flex-1 w-full">
            <FilterBar 
              filters={filters} 
              onFilterChange={setFilters} 
              search={search}
              onSearchChange={(s) => updateFilter('q', s)}
              config={filterConfig}
              showSavedViews
              pageKey="members"
              orgId={orgId}
            />
          </div>
          <div className="mt-0 md:mt-0">
            <ExportMenu 
              onExport={handleExport} 
              isExporting={isExporting}
            />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <GlassTable columns={columns} rows={rows} />
        </div>
      </GlassCard>
    </AppShell>
  )
}
