'use client'

import { useEffect, useState, useMemo } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassSelect from '@components/ui/GlassSelect'
import { normalizeRoleForApi } from '@lib/permissions'
import { useListQuery } from '@/lib/hooks/useListQuery'
import FilterBar from '@/components/filters/FilterBar'
import SortSelect from '@/components/filters/SortSelect'
import { exportToCsv, exportToPdf, type ExportColumn } from '@/lib/export-utils'
import ExportMenu from '@/components/shared/ExportMenu'
import { Activity, Clock, Monitor, XCircle, CheckCircle, BarChart } from 'lucide-react'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string, departmentId?: string }
type Department = { id: string, name: string }

const PRIVILEGED_ROLES = ['admin','owner','super_admin','org_admin','hr','manager']

function formatHM(mins: number) { const m = Math.max(0, Math.round(mins||0)); const h=Math.floor(m/60); const mm=String(m%60).padStart(2,'0'); return `${h}:${mm}` }

export default function ActivityOverviewPage() {
  const { filters, search, setFilters, updateFilter } = useListQuery()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [members, setMembers] = useState<User[]>([])
  const [projects, setProjects] = useState<{id:string, name:string}[]>([])
  const [clients, setClients] = useState<{id:string, name:string}[]>([])
  const [items, setItems] = useState<any[]>([])
  const [totals, setTotals] = useState<any>({ tracked:0, productive:0, unproductive:0, idle:0, screenshots:0 })
  const [role, setRole] = useState('')
  const [actorId, setActorId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Derived state from URL filters
  const orgId = filters.orgId || ''
  const from = filters.from || new Date().toISOString().slice(0,10)
  const to = filters.to || new Date().toISOString().slice(0,10)
  
  // Initial Auth & Role Setup
  useEffect(()=>{ 
    try { 
      const r = normalizeRoleForApi((typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''))
      setRole(r)
      const uid = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_user_id='))?.split('=')[1] || '') : ''
      setActorId(uid)
    } catch {} 
  }, [])

  // Load Orgs
  useEffect(() => {
    const loadOrgs = async () => {
      const endpoint = role === 'super_admin' ? '/api/org/list' : '/api/orgs/my'
      const res = await fetch(endpoint, { cache:'no-store' })
      const d = await res.json()
      const items: Org[] = Array.isArray(d.items) ? (d.items as Org[]) : []
      setOrgs(items)
      
      // Set default org if not in URL
      if (!orgId && items.length) {
        const cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
        const preferred = items.find(o => o.id === cookieOrgId)?.id || items[0].id
        updateFilter('orgId', preferred)
      }
    }
    if (role) loadOrgs()
  }, [role, orgId, updateFilter])

  // Load Departments & Users
  useEffect(() => {
    if (!orgId) return
    const loadDepsUsers = async () => {
      const [dRes, uRes] = await Promise.all([ 
        fetch(`/api/department/list?orgId=${orgId}`, { cache:'no-store' }), 
        fetch(`/api/user/list?orgId=${orgId}`, { cache:'no-store' }) 
      ])
      const [d,u] = await Promise.all([dRes.json(), uRes.json()])
      setDepartments(Array.isArray(d.items) ? d.items : [])
      setMembers(Array.isArray(u.items) ? u.items : [])
    }
    loadDepsUsers()
  }, [orgId])

  // Fetch Activity Data
  useEffect(() => {
    if (!orgId) return
    
    const loadOverview = async () => { 
      setIsLoading(true)
      try {
        let useMemberId = undefined
        // Force memberId to actorId for non-privileged users
        if (role && !PRIVILEGED_ROLES.includes(role) && actorId) {
          useMemberId = actorId
        }

        const params = new URLSearchParams()
        params.set('org_id', orgId)
        params.set('from', from)
        params.set('to', to)
        if (filters.userIds) params.set('userIds', filters.userIds)
        if (filters.deptId) params.set('department_id', filters.deptId)
        if (filters.projectId) params.set('projectId', filters.projectId)
        if (filters.clientId) params.set('clientId', filters.clientId)
        if (search) params.set('q', search)
        if (useMemberId) params.set('member_id', useMemberId)
        if (filters.idle_gt) params.set('idle_gt', filters.idle_gt)
        if (filters.missing_screenshots) params.set('missing_screenshots', filters.missing_screenshots === 'true' ? 'true' : 'false')
        if (filters.sort) params.set('sort', filters.sort)
        
        const res = await fetch(`/api/activity/overview?${params.toString()}`, { cache:'no-store', headers:{ 'x-role': role, 'x-user-id': actorId } })
        const d = await res.json()
        setItems(d.items||[])
        setTotals(d.totals||{ tracked:0, productive:0, unproductive:0, idle:0, screenshots:0 })
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    loadOverview()
  }, [orgId, from, to, search, filters, role, actorId])

  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      if (items.length === 0) {
        alert('No data to export')
        return
      }
      const exportColumns: ExportColumn[] = [
        { header: 'Member', accessor: 'memberName' },
        { header: 'Department', accessor: 'departmentName' },
        { header: 'Date', accessor: 'date' },
        { header: 'Worked', accessor: (i) => formatHM(i.workedHours) },
        { header: 'Tracked Active', accessor: (i) => formatHM(i.trackedActiveMinutes) },
        { header: 'Productive', accessor: (i) => formatHM(i.productiveMinutes) },
        { header: 'Unproductive', accessor: (i) => formatHM(i.unproductiveMinutes) },
        { header: 'Idle', accessor: (i) => formatHM(i.idleMinutes) },
        { header: 'Screenshots', accessor: (i) => String(i.screenshots || 0) },
        { header: 'Status', accessor: 'status' }
      ]

      const filename = `marq_activity_overview_${from}_${to}`
      if (type === 'csv') {
        await exportToCsv(items, exportColumns, filename)
      } else {
        await exportToPdf(items, exportColumns, 'Activity Overview', filename)
      }
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  // Filter Configuration
  const filterConfig = useMemo(() => [
    { 
      key: 'userIds', 
      label: 'Members', 
      type: 'multi-select' as const, 
      options: members.map(m => ({ label: `${m.firstName} ${m.lastName}`, value: m.id })) 
    },
    {
      key: 'departmentId',
      label: 'Department',
      type: 'select' as const,
      options: departments.map(d => ({ label: d.name, value: d.id }))
    },
    {
      key: 'projectId',
      label: 'Project',
      type: 'select' as const,
      options: projects.map(p => ({ label: p.name, value: p.id }))
    },
    {
      key: 'clientId',
      label: 'Client',
      type: 'select' as const,
      options: clients.map(c => ({ label: c.name, value: c.id }))
    }
  ], [members, departments, projects, clients])

  const columns = [
    { name: 'Member', width: '140px' },
    { name: 'Department', width: '120px' },
    { name: 'Date', width: '100px' },
    { name: 'Worked', width: '80px' },
    { name: 'Active', width: '80px' },
    { name: 'Productive', width: '80px' },
    { name: 'Unproductive', width: '90px' },
    { name: 'Idle', width: '70px' },
    { name: 'Screenshots', width: '90px' },
    { name: 'Top Usage', width: '220px' },
    { name: 'Status', width: '80px' }
  ]

  const rows = items.map(it => [
    <span key="mem" className="font-medium text-foreground">{it.memberName}</span>,
    <span key="dept" className="text-muted-foreground">{it.departmentName}</span>,
    <span key="date" className="text-muted-foreground">{it.date}</span>,
    <span key="wrk" className="font-medium">{formatHM(it.workedHours||0)}</span>,
    <span key="act" className="text-muted-foreground">{formatHM(it.trackedActiveMinutes||0)}</span>,
    <span key="prod" className="text-green-600 font-medium">{formatHM(it.productiveMinutes||0)}</span>,
    <span key="unp" className="text-red-500">{formatHM(it.unproductiveMinutes||0)}</span>,
    <span key="idle" className="text-orange-400">{formatHM(it.idleMinutes||0)}</span>,
    <span key="scr">{String(it.screenshots||0)}</span>,
    (
      <div key="usage" className="flex flex-col gap-1 py-1 text-xs min-w-[200px]">
        {it.topApps?.length > 0 && (
          <div>
             <div className="font-semibold opacity-70 text-[10px] uppercase mb-[2px]">Apps</div>
             {it.topApps.slice(0,3).map((a:any) => (
               <div key={a.name} className="flex items-center gap-[6px] w-full whitespace-nowrap" title={`${a.name}: ${a.minutes}m (${a.category})`}>
                 <div className={`shrink-0 w-[6px] h-[6px] rounded-full ${a.category === 'productive' ? 'bg-green-500' : a.category === 'unproductive' ? 'bg-red-400' : 'bg-gray-400'}`} />
                 <div className="overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                    <span className="font-medium">{a.name}</span> <span className="opacity-60 text-[10px]">({formatHM(a.minutes)})</span>
                 </div>
               </div>
             ))}
          </div>
        )}
        {it.topUrls?.length > 0 && (
          <div className={it.topApps?.length > 0 ? 'mt-2' : ''}>
            <div className="font-semibold opacity-70 text-[10px] uppercase mb-[2px]">Websites</div>
            {it.topUrls.slice(0,3).map((u:any) => (
              <div key={u.url} className="flex items-center gap-[6px] w-full whitespace-nowrap" title={`${u.url}: ${u.minutes}m (${u.category})`}>
                <div className={`shrink-0 w-[6px] h-[6px] rounded-full ${u.category === 'productive' ? 'bg-green-500' : u.category === 'unproductive' ? 'bg-red-400' : 'bg-gray-400'}`} />
                <div className="overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                    <span>{u.url}</span> <span className="opacity-60 text-[10px]">({formatHM(u.minutes)})</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {(!it.topApps?.length && !it.topUrls?.length) && <span className="opacity-30">-</span>}
      </div>
    ),
    <span key="status" className={`text-xs px-2 py-0.5 rounded-full ${it.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
      {it.status || 'Offline'}
    </span>
  ])

  return (
    <AppShell title="Activity Overview">
      {role === 'super_admin' && (
        <div className="mb-4 w-64">
          <GlassSelect value={orgId} onChange={(e:any)=>updateFilter('orgId', e.target.value)}>
            <option value="">Select org</option>
            {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
          </GlassSelect>
        </div>
      )}

      {PRIVILEGED_ROLES.includes(role) && (
        <FilterBar 
          pageKey="activity_overview" 
          orgId={orgId} 
          config={filterConfig}
          showSavedViews
        >
            <SortSelect 
              value={filters.sort || ''} 
              onChange={(val) => updateFilter('sort', val)}
              options={[
                { label: 'Worked Time (Desc)', value: 'worked:desc' },
                { label: 'Worked Time (Asc)', value: 'worked:asc' },
                { label: 'Idle Time (Desc)', value: 'idle:desc' },
                { label: 'Productive Time (Desc)', value: 'productive:desc' },
                { label: 'Unproductive Time (Desc)', value: 'unproductive:desc' },
              ]}
            />
        </FilterBar>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="card p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock size={18} />
            <span className="text-sm font-medium">Total Tracked</span>
          </div>
          <div className="text-3xl font-bold">{formatHM(totals.tracked||0)}</div>
          <div className="text-xs text-muted-foreground">Active minutes</div>
        </div>

        <div className="card p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BarChart size={18} />
            <span className="text-sm font-medium">Productivity Split</span>
          </div>
          <div className="flex items-baseline gap-4">
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-green-500">{formatHM(totals.productive||0)}</span>
              <span className="text-xs text-muted-foreground">Productive</span>
            </div>
            <div className="flex flex-col">
              <span className="text-3xl font-bold text-red-400">{formatHM(totals.unproductive||0)}</span>
              <span className="text-xs text-muted-foreground">Unproductive</span>
            </div>
          </div>
        </div>

        <div className="card p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Monitor size={18} />
            <span className="text-sm font-medium">Screenshots</span>
          </div>
          <div className="text-3xl font-bold">{String(totals.screenshots||0)}</div>
          <div className="text-xs text-muted-foreground">Captured</div>
        </div>
      </div>

      <GlassCard 
        title={<div className="flex items-center gap-2"><Activity size={18} /> Per-member Activity</div>} 
        className="mt-6" 
        right={<ExportMenu onExport={handleExport} isExporting={isExporting} />}
      >
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground opacity-50 flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
            Loading activity data...
          </div>
        ) : (
          <GlassTable columns={columns} rows={rows} />
        )}
      </GlassCard>
    </AppShell>
  )
}
