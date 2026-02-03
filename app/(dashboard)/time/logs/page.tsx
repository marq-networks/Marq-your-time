"use client"
import { useEffect, useState, useMemo } from 'react'
import AppShell from '@/components/ui/AppShell'
import GlassInput from '@/components/ui/GlassInput'
import GlassSelect from '@/components/ui/GlassSelect'
import GlassTable from '@/components/ui/GlassTable'
import GlassCard from '@/components/ui/GlassCard'
import FilterBar from '@/components/filters/FilterBar'
import { normalizeRoleForApi } from '@/lib/permissions'
import { useListQuery } from '@/lib/hooks/useListQuery'

import SortSelect from '@/components/filters/SortSelect'
import ExportMenu from '@/components/shared/ExportMenu'
import { exportToCsv, exportToPdf, ExportColumn } from '@/lib/export-utils'
import { Calendar, Clock, User, Briefcase, Building, Activity, TrendingUp, Zap, CheckCircle2 } from 'lucide-react'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string }
type Item = { id: string, name: string }

function formatHM(mins: number) {
  const m = Math.max(0, Math.round(mins || 0))
  const h = Math.floor(m / 60)
  const mm = String(m % 60).padStart(2,'0')
  return `${h}h ${mm}m`
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

  // Calculate stats
  const stats = useMemo(() => {
    const totalMins = sessions.reduce((acc, s) => acc + ((s.endTime || Date.now()) - s.startTime)/60000, 0)
    const active = sessions.filter(s => s.status === 'open').length
    
    const projMap = new Map()
    sessions.forEach(s => {
        const pName = projects.find(p => p.id === s.projectId)?.name || 'No Project'
        const dur = ((s.endTime || Date.now()) - s.startTime)/60000
        projMap.set(pName, (projMap.get(pName) || 0) + dur)
    })
    
    let topProject = { name: '-', mins: 0 }
    projMap.forEach((v, k) => {
        if (v > topProject.mins) topProject = { name: k, mins: v }
    })
    
    return {
        totalHours: formatHM(totalMins),
        activeSessions: active,
        topProject: topProject.name,
        logCount: sessions.length
    }
  }, [sessions, projects])

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

  const tableRows = sessions.map((s: any) => {
    const m = members.find(x => x.id === s.memberId)
    const name = m ? `${m.firstName} ${m.lastName}` : 'Unknown'
    const project = projects.find(p => p.id === s.projectId)?.name || '-'
    const client = clients.find(c => c.id === s.clientId)?.name || '-'
    const durationMins = Math.round(((s.endTime || Date.now()) - s.startTime)/60000)
    
    return [
      <div key="m" className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
            {m?.firstName?.[0]}{m?.lastName?.[0]}
        </div>
        <div>
            <div className="font-semibold text-gray-900">{name}</div>
            <div className="text-xs text-gray-500">Employee</div>
        </div>
      </div>,
      <div key="d" className="text-sm text-gray-600 font-medium">{new Date(s.startTime).toLocaleDateString()}</div>,
      <div key="t" className="flex flex-col text-sm">
        <div className="flex items-center gap-1.5 text-gray-900 font-medium">
            <Clock size={14} className="text-gray-400" />
            {new Date(s.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {s.endTime ? new Date(s.endTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Now'}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
             {s.status === 'open' ? 'Currently Active' : 'Completed'}
        </div>
      </div>,
      <div key="dur" className="flex items-center gap-2">
         <div className="font-mono text-sm font-semibold text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-200">{formatHM(durationMins)}</div>
         {durationMins > 60 && <span className="text-xs text-amber-500 font-medium">Long session</span>}
      </div>,
      <div key="p">
         {project !== '-' ? (
             <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                <Briefcase size={12} className="mr-1.5"/> {project}
             </span>
         ) : <span className="text-gray-400">-</span>}
      </div>,
      <div key="c">
          {client !== '-' ? (
             <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                <Building size={12} className="mr-1.5"/> {client}
             </span>
          ) : <span className="text-gray-400">-</span>}
      </div>,
      <div key="st">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          s.status === 'open' 
            ? 'bg-green-100 text-green-700 border border-green-200' 
            : 'bg-gray-100 text-gray-700 border border-gray-200'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${s.status === 'open' ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
          {s.status.toUpperCase()}
        </span>
      </div>
    ]
  })

  // Timeline Visualization
  const timelineData = useMemo(() => {
    // 24 hour buckets
    const buckets = Array(24).fill(0)
    sessions.forEach(s => {
        const start = new Date(s.startTime).getHours()
        const end = s.endTime ? new Date(s.endTime).getHours() : new Date().getHours()
        for (let h = start; h <= end; h++) {
            buckets[h]++
        }
    })
    const max = Math.max(...buckets, 1)
    return buckets.map(v => ({ value: v, height: (v/max)*100 }))
  }, [sessions])

  return (
    <AppShell title="Focus Mode Logs">
      <div className="flex flex-col gap-6 pb-20">
        
        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
           <GlassCard className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <Activity size={24} />
              </div>
              <div>
                  <div className="text-2xl font-bold text-gray-900">{stats.totalHours}</div>
                  <div className="text-sm text-gray-500 font-medium">Total Tracked</div>
              </div>
           </GlassCard>
           
           <GlassCard className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
                  <Zap size={24} />
              </div>
              <div>
                  <div className="text-2xl font-bold text-gray-900">{stats.activeSessions}</div>
                  <div className="text-sm text-gray-500 font-medium">Active Sessions</div>
              </div>
           </GlassCard>

           <GlassCard className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                  <TrendingUp size={24} />
              </div>
              <div>
                  <div className="text-lg font-bold text-gray-900 truncate max-w-[150px]" title={stats.topProject}>{stats.topProject}</div>
                  <div className="text-sm text-gray-500 font-medium">Top Project</div>
              </div>
           </GlassCard>
           
           <GlassCard className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                  <CheckCircle2 size={24} />
              </div>
              <div>
                  <div className="text-2xl font-bold text-gray-900">{stats.logCount}</div>
                  <div className="text-sm text-gray-500 font-medium">Sessions Logged</div>
              </div>
           </GlassCard>
        </div>

        {/* Timeline Chart */}
        {sessions.length > 0 && (
        <GlassCard className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Activity size={18} className="text-blue-500"/> Activity Density
                </h3>
                <span className="text-xs text-gray-400 font-medium">24 Hour View</span>
            </div>
            <div className="h-32 flex items-end gap-1 sm:gap-2">
                {timelineData.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                        <div 
                           className="w-full bg-blue-100 rounded-t-sm transition-all duration-300 group-hover:bg-blue-400 relative"
                           style={{ height: `${Math.max(d.height, 4)}%` }}
                        >
                            {d.value > 0 && (
                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                    {d.value} sessions
                                </div>
                            )}
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium">{i}</span>
                    </div>
                ))}
            </div>
        </GlassCard>
        )}

        {/* Controls Section */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-full sm:w-64">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Organization</label>
              {(['employee','member'].includes(role)) ? (
                <div className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 font-medium text-sm">
                  {orgs.find(o=>o.id===orgId)?.orgName || orgs[0]?.orgName || ''}
                </div>
              ) : (
                <GlassSelect value={orgId} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setOrgId(e.target.value)}>
                  <option value="">Select org</option>
                  {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
                </GlassSelect>
              )}
            </div>
            <div className="w-full sm:w-48">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Date</label>
              <div className="relative">
                  <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input 
                    type="date" 
                    value={date} 
                    onChange={(e: any) => setFilters({ ...filters, date: e.target.value })} 
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 justify-between items-start pt-4 border-t border-gray-100">
            <div className="flex-1 w-full overflow-x-auto pb-2">
              <FilterBar 
                pageKey="time_logs" 
                orgId={orgId} 
                config={filterConfig} 
                showSavedViews
              >
                <SortSelect 
                  options={[
                    { label: 'Newest First', value: 'startTime:desc' },
                    { label: 'Oldest First', value: 'startTime:asc' },
                    { label: 'Duration (Longest)', value: 'duration:desc' }
                  ]}
                  value={filters.sort || 'startTime:desc'}
                  onChange={(val) => setFilters({ ...filters, sort: val })}
                />
              </FilterBar>
            </div>
            <ExportMenu 
              onExport={handleExport} 
              isExporting={isExporting}
            />
          </div>
        </div>

        {/* Content Section */}
        <div className="space-y-4">
          {loading && (
            <div className="text-center py-20">
              <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500 font-medium">Loading time logs...</p>
            </div>
          )}
          
          {!loading && sessions.length === 0 && (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Clock className="text-gray-300" size={40} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No logs found</h3>
              <p className="text-gray-500 max-w-sm mx-auto">We couldn't find any time logs for this date. Try adjusting your filters or selecting a different date.</p>
            </div>
          )}

          {!loading && sessions.length > 0 && (
            <GlassTable 
              columns={['Member', 'Date', 'Time Session', 'Duration', 'Project', 'Client', 'Status']}
              rows={tableRows}
            />
          )}
        </div>
      </div>
    </AppShell>
  )
}
