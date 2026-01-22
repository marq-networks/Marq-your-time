'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'
import GlassModal from '@components/ui/GlassModal'
import { normalizeRoleForApi } from '@lib/permissions'
import { useListQuery } from '@/lib/hooks/useListQuery'
import FilterBar from '@/components/filters/FilterBar'
import ExportMenu from '@/components/shared/ExportMenu'
import { ExportColumn, exportToCsv, exportToPdf } from '@/lib/export-utils'

type Org = { id: string, orgName: string }
type Period = { id: string, period_start: string, period_end: string, status: string }

export default function PayrollHomePageV12() {
  const router = useRouter()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [selected, setSelected] = useState<string>('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ start: '', end: '' })
  const role = typeof document !== 'undefined' ? normalizeRoleForApi(document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''
  const [isExporting, setIsExporting] = useState(false)

  const { filters, setFilters, search, updateFilter } = useListQuery()
  const orgId = filters.orgId || ''

  const handleExport = async (type: 'csv' | 'pdf') => {
    if (!orgId) return
    setIsExporting(true)
    try {
      const exportItems = periods
      const exportColumns: ExportColumn[] = [
        { header: 'Period Start', accessor: 'period_start' },
        { header: 'Period End', accessor: 'period_end' },
        { header: 'Status', accessor: 'status' },
      ]
      const filename = `marq_payroll_periods_${new Date().toISOString().split('T')[0]}`
      if (type === 'csv') exportToCsv(exportItems, exportColumns, filename)
      else exportToPdf(exportItems, exportColumns, 'Payroll Periods', filename)
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const loadOrgs = async () => {
    const endpoint = role === 'super_admin' ? '/api/org/list' : '/api/orgs/my'
    const res = await fetch(endpoint, { cache:'no-store' })
    const d = await res.json()
    const items: Org[] = Array.isArray(d.items) ? d.items : []
    setOrgs(items)
    
    if (!orgId && items.length) {
      const cookieOrgId = typeof document !== 'undefined'
        ? (document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('current_org_id='))?.split('=')[1] || '')
        : ''
      const preferred = items.find(o => o.id === cookieOrgId)?.id || items[0].id
      updateFilter('orgId', preferred)
    }
  }

  const loadPeriods = async () => { 
    if (!orgId) return
    const params = new URLSearchParams()
    params.set('org_id', orgId)
    params.set('limit', '50')
    if (search) params.set('q', search) // If periods have searchable fields
    if (filters.status) params.set('status', filters.status)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    
    const res = await fetch(`/api/payroll/periods/list?${params.toString()}`, { cache:'no-store' })
    const d = await res.json() 
    setPeriods(d.items||[]) 
  }

  const createPeriod = async () => {
    if (!orgId || !form.start || !form.end) return
    const res = await fetch('/api/payroll/periods/create', { method:'POST', headers:{ 'Content-Type':'application/json','x-role': role || 'admin' }, body: JSON.stringify({ org_id: orgId, period_start: form.start, period_end: form.end }) })
    if (res.ok) { setCreateOpen(false); setForm({ start:'', end:'' }); loadPeriods() }
  }
  const generate = async (id: string) => { await fetch('/api/payroll/periods/generate', { method:'POST', headers:{ 'Content-Type':'application/json','x-role': role || 'admin' }, body: JSON.stringify({ payroll_period_id: id, org_id: orgId }) }); loadPeriods() }

  useEffect(()=>{ if(role) loadOrgs() }, [role])
  useEffect(()=>{ if (orgId) loadPeriods() }, [orgId, filters, search])

  const filterConfig = useMemo(() => [
    {
      key: 'status',
      label: 'Status',
      type: 'select' as const,
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Generated', value: 'generated' },
        { label: 'Approved', value: 'approved' },
        { label: 'Paid', value: 'paid' }
      ]
    }
  ], [])

  const columns = ['Period','Status','Actions']
  const rows = periods.map(p => [
    `${p.period_start} → ${p.period_end}`,
    p.status,
    <div className="row" style={{ gap:8 }}>
      <GlassButton
        variant="primary"
        onClick={() => router.push(`/payroll_v12/${p.id}`)}
        style={{ background:'#39FF14', borderColor:'#39FF14' }}
      >
        Open
      </GlassButton>
      <GlassButton
        variant="primary"
        onClick={() => generate(p.id)}
        style={{ background:'#39FF14', borderColor:'#39FF14' }}
      >
        Generate
      </GlassButton>
    </div>
  ])

  return (
    <AppShell title="Payroll v12">
      <GlassCard title="Payroll Periods">
        <div className="grid grid-3" style={{ marginBottom: 16 }}>
          <div>
            <div className="label">Organization</div>
            {role === 'super_admin' ? (
              <GlassSelect value={orgId} onChange={(e:any)=>updateFilter('orgId', e.target.value)}>
                <option value="">Select org</option>
                {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
              </GlassSelect>
            ) : (
              <span className="tag-pill">
                {orgs.find(o => o.id === orgId)?.orgName || orgs[0]?.orgName || ''}
              </span>
            )}
          </div>
          <div className="row" style={{ alignItems:'end', gap:8 }}>
            <ExportMenu isExporting={isExporting} onExport={handleExport} />
            <GlassButton variant="primary" onClick={()=>setCreateOpen(true)} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Create Period</GlassButton>
            {selected && <GlassButton variant="secondary" href={`/payroll_v12/${selected}`} style={{ background:'rgba(255,255,255,0.6)' }}>Open Selected</GlassButton>}
          </div>
        </div>

        <FilterBar 
          filters={filters} 
          onFilterChange={setFilters} 
          search={search}
          onSearchChange={(s) => updateFilter('q', s)}
          config={filterConfig}
          showSavedViews
          pageKey="payroll"
          orgId={orgId}
        />
        
        <div style={{ marginTop: 16 }}>
          <GlassTable columns={columns} rows={rows} />
        </div>
      </GlassCard>

      {createOpen && (
        <GlassModal open={createOpen} title="Create Period" onClose={()=>setCreateOpen(false)}>
          <div className="grid" style={{ gap:12 }}>
            <div>
              <label>Start Date</label>
              <input type="date" value={form.start} onChange={e=>setForm({...form, start:e.target.value})} className="glass-input" />
            </div>
            <div>
              <label>End Date</label>
              <input type="date" value={form.end} onChange={e=>setForm({...form, end:e.target.value})} className="glass-input" />
            </div>
            <GlassButton variant="primary" onClick={createPeriod}>Create</GlassButton>
          </div>
        </GlassModal>
      )}
    </AppShell>
  )
}
