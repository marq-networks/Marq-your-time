"use client"
import { useEffect, useState, useMemo } from 'react'
import AppShell from '@/components/ui/AppShell'
import GlassCard from '@/components/ui/GlassCard'
import GlassInput from '@/components/ui/GlassInput'
import GlassSelect from '@/components/ui/GlassSelect'
import FilterBar from '@/components/filters/FilterBar'
import { normalizeRoleForApi } from '@/lib/permissions'
import { useListQuery } from '@/lib/hooks/useListQuery'

import SortSelect from '@/components/filters/SortSelect'
import ExportMenu from '@/components/shared/ExportMenu'
import { exportToCsv, exportToPdf, ExportColumn } from '@/lib/export-utils'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string }
type Item = { id: string, name: string }

function formatHM(mins: number) {
  const m = Math.max(0, Math.round(mins || 0))
  const h = Math.floor(m / 60)
  const mm = String(m % 60).padStart(2,'0')
  return `${h}:${mm}`
}

export default function TimeLogsPage() {
  const [role, setRole] = useState('')
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [members, setMembers] = useState<User[]>([])
  const [projects, setProjects] = useState<Item[]>([])
  const [clients, setClients] = useState<Item[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  
  // Use shared hook for URL state
  const { filters, setFilters, search } = useListQuery()
  
  // Default date if not in URL
  const date = filters.date || new Date().toISOString().slice(0, 10)

  useEffect(() => { 
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
    if (!orgId && items.length) {
      const cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
      const preferred = items.find(o => o.id === cookieOrgId)?.id || items[0].id
      setOrgId(preferred)
      // Only set date if not present
      if (!filters.date) {
        setFilters({ ...filters, date: new Date().toISOString().slice(0, 10) })
      }
    }
  }

  const loadMembers = async (oid: string) => {
    if (!oid) return
    const [uRes, pRes, cRes] = await Promise.all([
      fetch(`/api/user/list?orgId=${oid}`, { cache: 'no-store' }),
      fetch(`/api/projects/list?orgId=${oid}`, { cache: 'no-store' }),
      fetch(`/api/clients/list?org_id=${oid}`, { cache: 'no-store' })
    ])
    const [u, p, c] = await Promise.all([uRes.json(), pRes.json(), cRes.json()])
    setMembers(u.items || [])
    setProjects(p.items || [])
    setClients(c.items || [])
  }

  const loadLogs = async () => {
    if (!orgId || !date) return
    setLoading(true)
    
    // Build query params
    const params = new URLSearchParams()
    params.set('org_id', orgId)
    params.set('date', date)
    
    // Add other filters
    if (filters.userIds) params.set('userIds', filters.userIds)
    if (filters.status) params.set('status', filters.status)
    if (filters.projectId) params.set('projectId', filters.projectId)
    if (filters.clientId) params.set('clientId', filters.clientId)
    if (filters.idle_gt) params.set('idle_gt', filters.idle_gt)
    if (filters.missing_screenshots) params.set('missing_screenshots', filters.missing_screenshots)
    if (search) params.set('q', search)

    // Legacy support for single member dropdown if used
    if (filters.member_id) params.set('member_id', filters.member_id)
    
    try {
      const res = await fetch(`/api/time/logs?${params.toString()}`, { cache: 'no-store' })
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOrgs() }, [role])
  useEffect(() => { if (orgId) { loadMembers(orgId); } }, [orgId])
  useEffect(() => { if (orgId && date) loadLogs() }, [orgId, date, filters, search])

  const handleExport = async (type: 'csv' | 'pdf') => {
    if (!orgId || !date) return
    setIsExporting(true)
    try {
        const params = new URLSearchParams()
        params.set('org_id', orgId)
        params.set('date', date)
        
        if (filters.userIds) params.set('userIds', filters.userIds)
        if (filters.status) params.set('status', filters.status)
        if (filters.projectId) params.set('projectId', filters.projectId)
        if (filters.clientId) params.set('clientId', filters.clientId)
        if (filters.idle_gt) params.set('idle_gt', filters.idle_gt)
        if (filters.missing_screenshots) params.set('missing_screenshots', filters.missing_screenshots)
        if (search) params.set('q', search)
        if (filters.member_id) params.set('member_id', filters.member_id)
        
        const res = await fetch(`/api/time/logs?${params.toString()}`, { cache: 'no-store' })
        const data = await res.json()
        const exportItems = data.sessions || []

        const exportColumns: ExportColumn[] = [
            { header: 'Member', accessor: (s) => {
                const m = members.find(x => x.id === s.memberId)
                return m ? `${m.firstName} ${m.lastName}` : 'Unknown'
            }},
            { header: 'Date', accessor: (s) => new Date(s.startTime).toLocaleDateString() },
            { header: 'Start Time', accessor: (s) => new Date(s.startTime).toLocaleTimeString() },
            { header: 'End Time', accessor: (s) => s.endTime ? new Date(s.endTime).toLocaleTimeString() : 'Active' },
            { header: 'Duration', accessor: (s) => formatHM(Math.round(((s.endTime || Date.now()) - s.startTime)/60000)) },
            { header: 'Status', accessor: (s) => s.status.toUpperCase() },
        ]

        const filename = `marq_timelogs_${date}`
        if (type === 'csv') exportToCsv(exportItems, exportColumns, filename)
        else exportToPdf(exportItems, exportColumns, `Time Logs - ${date}`, filename)

    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  // Prepare filter config
  const filterConfig = useMemo(() => [
    {
      key: 'userIds',
      label: 'Members',
      type: 'multi-select' as const,
      options: members.map(m => ({ label: `${m.firstName} ${m.lastName}`, value: m.id }))
    },
    {
      key: 'status',
      label: 'Status',
      type: 'status' as const,
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Closed', value: 'closed' }
      ]
    },
    {
      key: 'projectId',
      label: 'Projects',
      type: 'multi-select' as const,
      options: projects.map(p => ({ label: p.name, value: p.id }))
    },
    {
      key: 'clientId',
      label: 'Clients',
      type: 'multi-select' as const,
      options: clients.map(c => ({ label: c.name, value: c.id }))
    },
    {
      key: 'idle_gt',
      label: 'Idle > X mins',
      type: 'select' as const,
      options: [
        { label: '> 5 mins', value: '5' },
        { label: '> 10 mins', value: '10' },
        { label: '> 15 mins', value: '15' },
        { label: '> 30 mins', value: '30' },
        { label: '> 60 mins', value: '60' }
      ]
    },
    {
      key: 'missing_screenshots',
      label: 'Missing Screenshots',
      type: 'status' as const,
      options: [
        { label: 'Yes', value: 'true' },
        { label: 'No', value: 'false' }
      ]
    }
  ], [members, projects, clients])

  return (
    <AppShell title="Time Logs">
      <div className="mb-6 space-y-4">
        {/* Org Selector & Date - Keep visible as primary controls */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-64">
            <div className="label">Organization</div>
            {(['employee','member'].includes(role)) ? (
              <span className="tag-pill">{orgs.find(o=>o.id===orgId)?.orgName || orgs[0]?.orgName || ''}</span>
            ) : (
              <GlassSelect value={orgId} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setOrgId(e.target.value)}>
                <option value="">Select org</option>
                {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
              </GlassSelect>
            )}
          </div>
          <div className="w-48">
            <div className="label">Date</div>
            <GlassInput 
              type="date" 
              value={date} 
              onChange={(e: any) => setFilters({ ...filters, date: e.target.value })} 
            />
          </div>
        </div>

        {/* New Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start">
          <div className="flex-1 w-full">
            <FilterBar 
              pageKey="time_logs" 
              orgId={orgId} 
              config={filterConfig} 
              showSavedViews
            >
              <SortSelect 
                options={[
                  { label: 'Newest', value: 'startTime:desc' },
                  { label: 'Oldest', value: 'startTime:asc' },
                  { label: 'Longest', value: 'duration:desc' }
                ]}
                value={filters.sort || 'startTime:desc'}
                onChange={(val) => setFilters({ ...filters, sort: val })}
              />
            </FilterBar>
          </div>
          <div className="mt-0 md:mt-0">
            <ExportMenu 
              onExport={handleExport} 
              isExporting={isExporting}
            />
          </div>
        </div>
      </div>

      <div className="col" style={{ gap: 16 }}>
        {loading && <div className="text-center opacity-50 py-8">Loading logs...</div>}
        
        {!loading && sessions.length === 0 && (
          <div className="text-center opacity-50 py-8">No logs found for this criteria.</div>
        )}

        {sessions.map((s: any) => {
          const m = members.find(x => x.id === s.memberId)
          const name = m ? `${m.firstName} ${m.lastName}` : 'Unknown'
          return (
            <GlassCard key={s.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="col">
                  <div className="text-lg font-bold">{name}</div>
                  <div className="text-sm opacity-60">
                    {formatHM(Math.round((s.endTime - s.startTime)/60000))} hrs • {new Date(s.startTime).toLocaleTimeString()} - {s.endTime ? new Date(s.endTime).toLocaleTimeString() : 'Active'}
                  </div>
                </div>
                <div className="col" style={{ alignItems: 'flex-end' }}>
                  <div className={`status-pill ${s.status === 'open' ? 'success' : 'neutral'}`}>
                    {s.status.toUpperCase()}
                  </div>
                </div>
              </div>
            </GlassCard>
          )
        })}
      </div>
    </AppShell>
  )
}
