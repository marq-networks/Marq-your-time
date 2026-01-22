'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import { useListQuery } from '@/lib/hooks/useListQuery'
import FilterBar from '@/components/filters/FilterBar'
import ExportMenu from '@/components/shared/ExportMenu'
import { exportToCsv, exportToPdf, ExportColumn } from '@/lib/export-utils'

type Org = { id: string, orgName: string }

export default function TimesheetApprovalsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [candidates, setCandidates] = useState<any[]>([])
  const [showCandidates, setShowCandidates] = useState(false)
  const [members, setMembers] = useState<any[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const router = useRouter()
  
  const role = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''
  const userId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_user_id='))?.split('=')[1] || '') : ''
  const currentOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''

  // Use shared hook for URL state
  const { filters, setFilters, search, updateFilter } = useListQuery()
  const page = parseInt(filters.page || '1')
  const pageSize = parseInt(filters.pageSize || '50')

  const loadOrgs = async () => {
    try {
      if (role === 'super_admin') {
        const r = await fetch('/api/org/list', { cache:'no-store', headers:{ 'x-user-id': userId, 'x-role': role } })
        const d = await r.json()
        setOrgs(d.items || [])
        if (d.items && d.items.length > 0 && !orgId) setOrgId(d.items[0].id)
      } else {
        // Load user's organizations
        const r = await fetch('/api/orgs/my', { cache:'no-store', headers:{ 'x-user-id': userId } })
        const d = await r.json()
        setOrgs(d.items || [])
        if (d.items && d.items.length > 0) {
          // Prefer current_org_id if in the list, otherwise first
          const match = d.items.find((o:any) => o.id === currentOrgId)
          setOrgId(match ? match.id : d.items[0].id)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const loadMembers = async (oid: string) => {
    try {
      const r = await fetch(`/api/user/list?orgId=${oid}`)
      const d = await r.json()
      setMembers(d.items || d.users || [])
    } catch (e) { console.error(e) }
  }

  const loadCandidates = async () => {
    if (!orgId) return
    try {
        const r = await fetch(`/api/ai/candidates/list?orgId=${orgId}&status=pending`)
        const d = await r.json()
        setCandidates(d.items || [])
    } catch (e) { console.error(e) }
  }

  const loadItems = async () => {
    if (!orgId) { setItems([]); return }
    
    const params = new URLSearchParams()
    params.set('org_id', orgId)
    params.set('page', page.toString())
    params.set('pageSize', pageSize.toString())
    
    if (search) params.set('q', search)
    if (filters.status) params.set('status', filters.status)
    else params.set('status', 'submitted') // Default filter if none

    if (filters.userIds) params.set('userIds', filters.userIds)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    
    // Anomaly Filters
    if (filters.idle_gt) params.set('idle_gt', filters.idle_gt)
    if (filters.missing_screenshots) params.set('missing_screenshots', filters.missing_screenshots)
    if (filters.overtime_gt) params.set('overtime_gt', filters.overtime_gt)

    if (filters.sort) params.set('sort', filters.sort)

    try {
      const r = await fetch(`/api/timesheets/list?${params.toString()}`, { cache:'no-store', headers:{ 'x-role': role || 'admin', 'x-user-id': userId } })
      const d = await r.json()
      setItems(d.items || [])
      setTotalItems(d.total || 0)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId) loadMembers(orgId) }, [orgId])
  useEffect(()=>{ 
    if (showCandidates) loadCandidates()
    else loadItems() 
  }, [orgId, filters, search, page, pageSize, showCandidates])

  const handleExport = async (type: 'csv' | 'pdf') => {
    if (!orgId) return
    setIsExporting(true)
    try {
      const params = new URLSearchParams()
      params.set('org_id', orgId)
      params.set('page', '1')
      params.set('pageSize', '10000')
      
      if (search) params.set('q', search)
      if (filters.status) params.set('status', filters.status)
      else params.set('status', 'submitted')

      if (filters.userIds) params.set('userIds', filters.userIds)
      if (filters.from) params.set('from', filters.from)
      if (filters.to) params.set('to', filters.to)
      if (filters.idle_gt) params.set('idle_gt', filters.idle_gt)
      if (filters.missing_screenshots) params.set('missing_screenshots', filters.missing_screenshots)
      if (filters.overtime_gt) params.set('overtime_gt', filters.overtime_gt)
      if (filters.sort) params.set('sort', filters.sort)

      const r = await fetch(`/api/timesheets/list?${params.toString()}`, { cache:'no-store', headers:{ 'x-role': role || 'admin', 'x-user-id': userId } })
      const d = await r.json()
      const exportItems = d.items || []

      const exportColumns: ExportColumn[] = [
        { header: 'Employee', accessor: (it) => `${it.employees?.first_name || ''} ${it.employees?.last_name || ''}`.trim() },
        { header: 'Period', accessor: (it) => `${it.period_start} - ${it.period_end}` },
        { header: 'Status', accessor: (it) => it.status.toUpperCase() },
        { header: 'Total Worked', accessor: (it) => `${Math.round(it.totals?.worked_minutes / 60 || 0)}h ${Math.round((it.totals?.worked_minutes || 0) % 60)}m` },
      ]

      const filename = `marq_timesheets_${new Date().toISOString().split('T')[0]}`
      if (type === 'csv') exportToCsv(exportItems, exportColumns, filename)
      else exportToPdf(exportItems, exportColumns, 'Timesheet Approvals', filename)
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
      type: 'status' as const,
      options: [
        { label: 'Submitted', value: 'submitted' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
        { label: 'Changes Required', value: 'changes_required' },
        { label: 'Draft', value: 'draft' }
      ]
    },
    {
      key: 'userIds',
      label: 'Employees',
      type: 'multi-select' as const,
      options: members.map(m => ({ label: `${m.firstName} ${m.lastName}`, value: m.id }))
    },
    {
      key: 'date',
      label: 'Period',
      type: 'date-range' as const
    },
    {
      key: 'idle_gt',
      label: 'Idle > X min',
      type: 'select' as const,
      options: [
        { label: 'Any', value: '' },
        { label: '> 30 mins', value: '30' },
        { label: '> 1 hour', value: '60' },
        { label: '> 2 hours', value: '120' },
        { label: '> 4 hours', value: '240' }
      ]
    },
    {
      key: 'missing_screenshots',
      label: 'Missing Screenshots',
      type: 'select' as const,
      options: [
        { label: 'All', value: '' },
        { label: 'Yes (Anomalies)', value: 'true' }
      ]
    },
    {
      key: 'overtime_gt',
      label: 'Overtime > X min',
      type: 'select' as const,
      options: [
        { label: 'Any', value: '' },
        { label: '> 30 mins', value: '30' },
        { label: '> 1 hour', value: '60' },
        { label: '> 2 hours', value: '120' }
      ]
    },
    {
      key: 'sort',
      label: 'Sort By',
      type: 'sort' as const,
      options: [
        { label: 'Period (Newest)', value: 'period_start:desc' },
        { label: 'Period (Oldest)', value: 'period_start:asc' }
      ]
    }
  ], [members])

  const candidateRows = candidates.map(c => [
    new Date(c.created_at).toLocaleDateString(),
    c.candidate_type.replace('_', ' ').toUpperCase(),
    c.reason,
    `${Math.round(c.confidence * 100)}%`,
    <div key={c.id} className="flex gap-2">
        <GlassButton size="sm" onClick={()=>router.push(`/timesheets/approvals/${c.timesheets?.id || ''}`)}>View TS</GlassButton>
        {/* <GlassButton size="sm" variant="success" onClick={()=>handleCandidateAction(c.id, 'approve')}>Apply</GlassButton> */}
    </div>
  ])

  const rows = items.map((it: any) => [
    `${it.employees?.first_name || ''} ${it.employees?.last_name || ''}`.trim(),
    `${it.period_start} - ${it.period_end}`,
    it.status.toUpperCase(),
    `${Math.round(it.totals?.worked_minutes / 60 || 0)}h ${Math.round((it.totals?.worked_minutes || 0) % 60)}m`,
    <GlassButton onClick={()=>router.push(`/timesheets/approvals/${it.id}`)}>Review</GlassButton>
  ])

  return (
    <AppShell title="Timesheet Approvals">
      <div className="flex justify-between items-center mb-4">
        <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)} className="w-64">
             <option value="">Select org</option>
             {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
        </GlassSelect>
        <div className="flex bg-white/5 p-1 rounded-lg">
            <button 
                className={`px-4 py-2 rounded-md text-sm transition-colors ${!showCandidates ? 'bg-[#39FF14] text-black font-medium' : 'text-white/70 hover:text-white'}`}
                onClick={()=>setShowCandidates(false)}
            >
                Timesheets
            </button>
            <button 
                className={`px-4 py-2 rounded-md text-sm transition-colors ${showCandidates ? 'bg-[#39FF14] text-black font-medium' : 'text-white/70 hover:text-white'}`}
                onClick={()=>setShowCandidates(true)}
            >
                AI Corrections ({candidates.length > 0 ? candidates.length : '0'})
            </button>
        </div>
      </div>

      {!showCandidates ? (
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start mb-4">
          <div className="flex-1 w-full">
            <FilterBar 
              pageKey="timesheets_approvals" 
              orgId={orgId} 
              config={filterConfig} 
              showSavedViews
            />
          </div>
          <div className="mt-0 md:mt-0">
            <ExportMenu 
              onExport={handleExport} 
              isExporting={isExporting}
            />
          </div>
      </div>
      ) : null}

      <GlassCard title={showCandidates ? "Pending AI Suggestions" : "Timesheets"}>
        {showCandidates ? (
            <GlassTable 
                columns={['Date Detected', 'Type', 'Reason', 'Confidence', 'Actions']}
                rows={candidateRows}
            />
        ) : (
        <>
        <GlassTable columns={[ 'Employee', 'Period', 'Status', 'Total Worked', 'Actions' ]} rows={rows} />
        {/* Pagination Controls */}
        <div className="flex items-center justify-between mt-4">
             <div className="text-sm opacity-60">
               Showing {items.length} of {totalItems} timesheets
             </div>
             <div className="flex gap-2">
               <GlassButton 
                 disabled={page <= 1}
                 onClick={() => updateFilter('page', String(page - 1))}
               >
                 Previous
               </GlassButton>
               <GlassButton 
                 disabled={page * pageSize >= totalItems}
                 onClick={() => updateFilter('page', String(page + 1))}
               >
                 Next
               </GlassButton>
             </div>
        </div>
        </>
        )}
      </GlassCard>
    </AppShell>
  )
}
