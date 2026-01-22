'use client'

import { useEffect, useState, useMemo } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassSelect from '@components/ui/GlassSelect'
import { normalizeRoleForApi } from '@lib/permissions'
import { useListQuery } from '@/lib/hooks/useListQuery'
import FilterBar from '@/components/filters/FilterBar'
import DateRangePicker from '@/components/filters/DateRangePicker'
import SortSelect from '@/components/filters/SortSelect'
import { exportToCsv, exportToPdf, type ExportColumn } from '@/lib/export-utils'
import ExportMenu from '@/components/shared/ExportMenu'

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

  const columns = ['Member','Department','Date','Worked','Tracked Active','Productive','Unproductive','Idle','Screenshots','Top Usage','Status']
  const rows = items.map(it => [
    it.memberName, 
    it.departmentName, 
    it.date, 
    formatHM(it.workedHours||0), 
    formatHM(it.trackedActiveMinutes||0), 
    formatHM(it.productiveMinutes||0), 
    formatHM(it.unproductiveMinutes||0), 
    formatHM(it.idleMinutes||0), 
    String(it.screenshots||0), 
    (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '220px', padding: '4px 0', fontSize: '12px' }}>
        {it.topApps?.length > 0 && (
          <div>
             <div style={{ fontWeight: 600, opacity: 0.7, fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>Apps</div>
             {it.topApps.slice(0,3).map((a:any) => (
               <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', whiteSpace: 'nowrap' }} title={`${a.name}: ${a.minutes}m (${a.category})`}>
                 <div style={{ flexShrink: 0, width: '6px', height: '6px', borderRadius: '999px', background: a.category === 'productive' ? '#34d399' : a.category === 'unproductive' ? '#fb7185' : '#9ca3af' }} />
                 <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    <span style={{ fontWeight: 500 }}>{a.name}</span> <span style={{ opacity: 0.6, fontSize: '10px' }}>({formatHM(a.minutes)})</span>
                 </div>
               </div>
             ))}
          </div>
        )}
        {it.topUrls?.length > 0 && (
          <div style={{ marginTop: it.topApps?.length > 0 ? '8px' : '0' }}>
            <div style={{ fontWeight: 600, opacity: 0.7, fontSize: '10px', textTransform: 'uppercase', marginBottom: '2px' }}>Websites</div>
            {it.topUrls.slice(0,3).map((u:any) => (
              <div key={u.url} style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', whiteSpace: 'nowrap' }} title={`${u.url}: ${u.minutes}m (${u.category})`}>
                <div style={{ flexShrink: 0, width: '6px', height: '6px', borderRadius: '999px', background: u.category === 'productive' ? '#34d399' : u.category === 'unproductive' ? '#fb7185' : '#9ca3af' }} />
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    <span>{u.url}</span> <span style={{ opacity: 0.6, fontSize: '10px' }}>({formatHM(u.minutes)})</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {(!it.topApps?.length && !it.topUrls?.length) && <span style={{ opacity: 0.3 }}>-</span>}
      </div>
    ),
    it.status 
  ])

  return (
    <AppShell title="Activity Overview">
      {role === 'super_admin' && (
        <div className="mb-4">
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

      <div className="grid grid-1 mt-4">
        <GlassCard title="Total Tracked">
          <div className="title">{formatHM(totals.tracked||0)}</div>
          <div className="subtitle">Active minutes</div>
        </GlassCard>
        <GlassCard title="Productive vs Unproductive">
          <div className="row" style={{gap:12}}>
            <div className="title" style={{color:'var(--green)'}}>{formatHM(totals.productive||0)}</div>
            <div className="title" style={{color:'var(--orange)'}}>{formatHM(totals.unproductive||0)}</div>
          </div>
        </GlassCard>
        <GlassCard title="Screenshots">
          <div className="title">{String(totals.screenshots||0)}</div>
        </GlassCard>
      </div>

      <GlassCard title="Per-member Activity" className="mt-6" right={<ExportMenu onExport={handleExport} isExporting={isExporting} />}>
        {isLoading ? (
          <div className="p-8 text-center opacity-50">Loading activity data...</div>
        ) : (
          <GlassTable columns={columns} rows={rows} />
        )}
      </GlassCard>
    </AppShell>
  )
}
