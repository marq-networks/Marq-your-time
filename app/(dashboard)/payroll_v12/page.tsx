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
import { 
  DollarSign, 
  Calendar, 
  Plus, 
  FileText, 
  CheckCircle, 
  Clock, 
  CreditCard, 
  ChevronRight, 
  Download, 
  Briefcase,
  AlertCircle
} from 'lucide-react'

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

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid': return <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1 w-fit"><CheckCircle size={12} /> Paid</span>
      case 'approved': return <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center gap-1 w-fit"><CheckCircle size={12} /> Approved</span>
      case 'generated': return <span className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center gap-1 w-fit"><FileText size={12} /> Generated</span>
      default: return <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center gap-1 w-fit"><Clock size={12} /> Draft</span>
    }
  }

  const columns = ['Period', 'Status', 'Actions']
  const rows = periods.map(p => [
    <div className="flex items-center gap-2 font-medium text-slate-700">
      <Calendar size={16} className="text-indigo-500" />
      {p.period_start} <span className="text-slate-400">→</span> {p.period_end}
    </div>,
    getStatusBadge(p.status),
    <div className="flex items-center gap-2">
      <GlassButton
        variant="primary"
        onClick={() => router.push(`/payroll_v12/${p.id}`)}
        className="bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-md shadow-indigo-200"
      >
        Open
      </GlassButton>
      <GlassButton
        variant="secondary"
        onClick={() => generate(p.id)}
        className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
      >
        Generate
      </GlassButton>
    </div>
  ])

  return (
    <AppShell title="Payroll Management">
      <div className="space-y-6 max-w-7xl mx-auto p-6">
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <GlassCard className="relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <DollarSign size={64} className="text-indigo-600" />
            </div>
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Clock size={18} className="text-indigo-600" />
              <span className="text-sm font-semibold uppercase tracking-wider">Active Periods</span>
            </div>
            <div className="text-3xl font-bold text-slate-700">{periods.length}</div>
            <div className="text-xs text-slate-500 font-medium">Payroll cycles tracked</div>
          </GlassCard>
          
          <GlassCard className="relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <CheckCircle size={64} className="text-emerald-600" />
            </div>
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <CheckCircle size={18} className="text-emerald-600" />
              <span className="text-sm font-semibold uppercase tracking-wider">Completed</span>
            </div>
            <div className="text-3xl font-bold text-slate-700">{periods.filter(p => p.status === 'paid').length}</div>
            <div className="text-xs text-slate-500 font-medium">Periods paid out</div>
          </GlassCard>

          <GlassCard className="flex flex-col justify-center items-start gap-3">
             <div className="text-sm font-medium text-slate-500">Quick Actions</div>
             <GlassButton 
               variant="primary" 
               onClick={()=>setCreateOpen(true)} 
               className="w-full justify-center bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-lg shadow-indigo-200 flex items-center gap-2"
             >
               <Plus size={16} /> Create New Period
             </GlassButton>
          </GlassCard>
        </div>

        <GlassCard className="min-h-[500px] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Briefcase size={120} className="text-indigo-500" />
          </div>
          <div className="relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
             <div>
               <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                 <Briefcase className="text-indigo-600" size={24} />
                 Payroll Periods
               </h2>
               <p className="text-slate-500 text-sm mt-1">Manage and process payroll cycles for your organization</p>
             </div>
             
             <div className="flex flex-wrap items-center gap-3">
               {role === 'super_admin' ? (
                  <div className="min-w-[200px]">
                    <GlassSelect value={orgId} onChange={(e:any)=>updateFilter('orgId', e.target.value)} className="w-full">
                      <option value="">Select Organization</option>
                      {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
                    </GlassSelect>
                  </div>
                ) : (
                  <div className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-medium text-slate-600 flex items-center gap-2 border border-slate-200">
                    <Briefcase size={14} />
                    {orgs.find(o => o.id === orgId)?.orgName || orgs[0]?.orgName || 'My Organization'}
                  </div>
                )}
                <ExportMenu isExporting={isExporting} onExport={handleExport} />
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
          
          <div className="mt-6">
            {periods.length > 0 ? (
              <GlassTable columns={columns} rows={rows} />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 bg-slate-50 rounded-full mb-4">
                  <Calendar size={48} className="text-slate-300" />
                </div>
                <h3 className="text-lg font-medium text-slate-700">No payroll periods found</h3>
                <p className="text-slate-500 max-w-sm mt-2 mb-6">
                  Get started by creating your first payroll period to track employee time and payments.
                </p>
                <GlassButton 
                   variant="primary" 
                   onClick={()=>setCreateOpen(true)}
                   className="bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-lg shadow-indigo-200"
                >
                  <Plus size={16} className="mr-2" /> Create Period
                </GlassButton>
              </div>
            )}
          </div>
          </div>
        </GlassCard>

        {createOpen && (
          <GlassModal open={createOpen} title="Create Payroll Period" onClose={()=>setCreateOpen(false)}>
            <div className="space-y-4 p-1">
              <div className="bg-indigo-50 p-3 rounded-lg flex items-start gap-3 border border-indigo-100">
                <AlertCircle className="text-indigo-600 shrink-0 mt-0.5" size={18} />
                <p className="text-xs text-indigo-700 leading-relaxed">
                  Define the start and end dates for this payroll cycle. Once created, you can generate payslips based on tracked time.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Start Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <input 
                      type="date" 
                      value={form.start} 
                      onChange={e=>setForm({...form, start:e.target.value})} 
                      className="w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">End Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <input 
                      type="date" 
                      value={form.end} 
                      onChange={e=>setForm({...form, end:e.target.value})} 
                      className="w-full pl-10 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <GlassButton 
                  variant="primary" 
                  onClick={createPeriod}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-lg shadow-indigo-200 w-full justify-center"
                >
                  Create Period
                </GlassButton>
              </div>
            </div>
          </GlassModal>
        )}
      </div>
    </AppShell>
  )
}
