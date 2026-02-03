'use client'
import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'
import { normalizeRoleForApi } from '@lib/permissions'
import { useListQuery } from '@/lib/hooks/useListQuery'
import FilterBar from '@/components/filters/FilterBar'
import ExportMenu from '@/components/shared/ExportMenu'
import { exportToCsv, exportToPdf, type ExportColumn } from '@/lib/export-utils'
import { 
  FileText, 
  Download, 
  Play, 
  Search, 
  Filter, 
  Calendar, 
  Building2, 
  Sparkles,
  ChevronRight,
  ChevronLeft,
  FileCheck,
  FileX
} from 'lucide-react'

type Org = { id: string, orgName: string }
type Period = { id: string, period_start: string, period_end: string, status: string }
type Payslip = {
  id: string
  slipNumber: string
  userId: string
  employeeName: string
  departmentName?: string
  payrollPeriodId: string
  periodStart: string
  periodEnd: string
  netSalary: number
  currency: string
  hasPdf: boolean
  createdAt: string
}

function fmtCurrency(v: number, curr = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: curr }).format(v)
  } catch {
    return `${curr} ${v.toFixed(2)}`
  }
}

export default function PayslipsDashboardPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [periods, setPeriods] = useState<Period[]>([])
  const [items, setItems] = useState<Payslip[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [members, setMembers] = useState<any[]>([])
  const [role, setRole] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const { filters, search, updateFilter } = useListQuery()
  const page = parseInt(filters.page || '1')
  const pageSize = parseInt(filters.pageSize || '50')
  const periodId = filters.period || ''

  const loadOrgs = async () => {
    const endpoint = role === 'super_admin' ? '/api/org/list' : '/api/orgs/my'
    const res = await fetch(endpoint, { cache: 'no-store' })
    const d = await res.json()
    const list: Org[] = Array.isArray(d.items) ? d.items : []
    setOrgs(list)
    if (!orgId && list.length) {
      const cookieOrgId = typeof document !== 'undefined'
        ? (document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('current_org_id='))?.split('=')[1] || '')
        : ''
      const preferred = list.find(o => o.id === cookieOrgId)?.id || list[0].id
      setOrgId(preferred)
    }
  }

  const loadPeriods = async (oid: string) => {
    const res = await fetch(`/api/payroll/periods/list?org_id=${oid}&limit=50`, { cache: 'no-store' })
    const d = await res.json()
    const list: Period[] = Array.isArray(d.items) ? d.items : []
    setPeriods(list)
    if (!periodId && list.length) updateFilter('period', list[0].id)
  }

  const loadMembers = async (oid: string) => {
    try {
      const r = await fetch(`/api/user/list?orgId=${oid}`)
      const d = await r.json()
      setMembers(d.items || d.users || [])
    } catch (e) { console.error(e) }
  }

  const loadPayslips = async () => {
    if (!orgId || !periodId || !role) {
      setItems([])
      setTotalItems(0)
      return
    }
    const headers: Record<string, string> = {}
    headers['x-role'] = role

    const params = new URLSearchParams()
    params.set('org_id', orgId)
    params.set('period', periodId)
    params.set('page', page.toString())
    params.set('pageSize', pageSize.toString())
    if (search) params.set('q', search)
    if (filters.userIds) params.set('userIds', filters.userIds)
    if (filters.status) params.set('status', filters.status)
    if (filters.sort) params.set('sort', filters.sort)

    const res = await fetch(`/api/payslips?${params.toString()}`, {
      cache: 'no-store',
      headers
    })
    if (!res.ok) {
      setItems([])
      setTotalItems(0)
      return
    }
    const d = await res.json()
    const list: Payslip[] = Array.isArray(d.items) ? d.items : []
    setItems(list)
    setTotalItems(d.total || list.length)
  }

  const generatePayslips = async () => {
    if (!orgId || !role) {
      if (typeof window !== 'undefined') window.alert('Organization or role missing. Please reload and try again.')
      return
    }
    if (!periodId) {
      if (typeof window !== 'undefined') {
        if (!periods.length) {
          window.alert('No payroll periods found. Please create and generate a payroll period in Payroll v12 first.')
        } else {
          window.alert('Please select a payroll period before generating payslips.')
        }
      }
      return
    }
    
    setIsGenerating(true)
    const headers: Record<string, string> = {}
    headers['x-role'] = role
    
    try {
      const res = await fetch(
        `/api/payslips/generate?org_id=${encodeURIComponent(orgId)}&period=${encodeURIComponent(periodId)}`,
        {
          method: 'POST',
          headers
        }
      )
      if (!res.ok) {
        const data = await res.json()
        const raw = typeof data?.error === 'string' ? data.error : ''
        const msg =
          raw === 'NO_APPROVED_ROWS'
            ? 'No approved payroll rows for this period. Open Payroll v12, generate payroll for this period, approve it, then try again.'
            : raw || 'Failed to generate payslips'
        if (typeof window !== 'undefined') window.alert(msg)
        return
      }
      loadPayslips()
    } catch {
      if (typeof window !== 'undefined') window.alert('Failed to generate payslips')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExport = async (type: 'csv' | 'pdf') => {
    if (!orgId || !periodId) {
      if (typeof window !== 'undefined') window.alert('Please select a payroll period before exporting.')
      return
    }

    try {
      setIsExporting(true)
      const params = new URLSearchParams()
      params.set('org_id', orgId)
      params.set('period', periodId)
      params.set('page', '1')
      params.set('pageSize', '10000')
      if (search) params.set('q', search)
      if (filters.userIds) params.set('userIds', filters.userIds)
      if (filters.status) params.set('status', filters.status)
      if (filters.sort) params.set('sort', filters.sort)

      const headers: Record<string, string> = {}
      if (role) headers['x-role'] = role

      const res = await fetch(`/api/payslips?${params.toString()}`, { headers })
      if (!res.ok) throw new Error('Failed to fetch data for export')
      
      const data = await res.json()
      const exportItems: Payslip[] = Array.isArray(data.items) ? data.items : []

      if (exportItems.length === 0) {
        window.alert('No data to export')
        return
      }

      const exportColumns: ExportColumn[] = [
        { header: 'Employee', accessor: 'employeeName' },
        { header: 'Department', accessor: 'departmentName' },
        { header: 'Period Start', accessor: 'periodStart' },
        { header: 'Period End', accessor: 'periodEnd' },
        { header: 'Net Salary', accessor: (item) => fmtCurrency(item.netSalary, item.currency) },
        { header: 'Slip Number', accessor: 'slipNumber' },
        { header: 'Created At', accessor: (item) => new Date(item.createdAt).toLocaleString() },
        { header: 'Status', accessor: (item) => item.hasPdf ? 'Generated' : 'Pending' },
      ]

      const filename = `marq_payslips_${new Date().toISOString().split('T')[0]}`

      if (type === 'csv') {
        exportToCsv(exportItems, exportColumns, filename)
      } else {
        exportToPdf(exportItems, exportColumns, 'Payslips', filename)
      }
    } catch (e) {
      console.error(e)
      window.alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  useEffect(() => {
    try {
      const r = normalizeRoleForApi(
        typeof document !== 'undefined'
          ? (document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('current_role='))?.split('=')[1] || '')
          : ''
      )
      setRole(r)
    } catch {}
  }, [])

  useEffect(() => {
    if (role && ['admin', 'owner', 'manager', 'finance', 'super_admin'].includes(role)) {
      loadOrgs()
    }
  }, [role])

  useEffect(() => {
    if (orgId) {
      loadPeriods(orgId)
      loadMembers(orgId)
    }
  }, [orgId])

  useEffect(() => {
    loadPayslips()
  }, [orgId, periodId, role, search, filters])

  const filterConfig = useMemo(() => [
    { 
      key: 'userIds', 
      label: 'Employees', 
      type: 'multi-select' as const, 
      options: members.map(m => ({ label: `${m.firstName} ${m.lastName}`, value: m.id })) 
    },
    {
      key: 'status',
      label: 'Status',
      type: 'status' as const,
      options: [
        { label: 'Generated (PDF)', value: 'generated' },
        { label: 'Sent', value: 'sent' },
        { label: 'Paid', value: 'paid' },
        { label: 'Pending', value: 'pending' }
      ]
    },
    { 
      key: 'sort', 
      label: 'Sort By', 
      type: 'sort' as const, 
      options: [
        { label: 'Newest First', value: 'created_at:desc' },
        { label: 'Oldest First', value: 'created_at:asc' },
        { label: 'Highest Amount', value: 'amount:desc' },
        { label: 'Lowest Amount', value: 'amount:asc' },
      ] 
    }
  ], [members])

  const columns = ['Employee', 'Department', 'Period', 'Net Salary', 'Slip #', 'Created', 'Actions']
  const rows = items.map(p => [
    <div key={p.id} className="font-medium text-gray-900">{p.employeeName}</div>,
    <div key={p.id + 'dept'} className="text-gray-500">{p.departmentName || '-'}</div>,
    <div key={p.id + 'period'} className="text-xs text-gray-500">
      {p.periodStart} <span className="text-gray-300">→</span> {p.periodEnd}
    </div>,
    <div key={p.id + 'net'} className="font-bold text-gray-900">{fmtCurrency(p.netSalary, p.currency)}</div>,
    <div key={p.id + 'slip'} className="font-mono text-xs text-gray-500">{p.slipNumber}</div>,
    <div key={p.id + 'created'} className="text-xs text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</div>,
    <div key={p.id + 'actions'} className="flex gap-2">
      <button
        disabled={!p.hasPdf}
        onClick={() => p.hasPdf && window.open(`/api/payslips/${p.id}/pdf`, '_blank')}
        className={`p-2 rounded-lg transition-all ${
          p.hasPdf 
            ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:shadow-md' 
            : 'bg-gray-50 text-gray-300 cursor-not-allowed'
        }`}
        title={p.hasPdf ? "View PDF" : "PDF not generated"}
      >
        <FileText size={16} />
      </button>
    </div>
  ])

  return (
    <AppShell title="Payslips Management">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        {/* Control Panel */}
        <GlassCard className="overflow-hidden relative border-none shadow-xl bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-80" />
          
          <div className="flex flex-col lg:flex-row gap-6 items-end justify-between p-2">
            <div className="flex flex-col md:flex-row gap-6 flex-1 w-full">
              <div className="flex-1 min-w-[240px]">
                {role === 'super_admin' ? (
                  <GlassSelect 
                    value={orgId} 
                    onChange={(e: any) => setOrgId(e.target.value)} 
                    className="w-full"
                    icon={Building2}
                  >
                    <option value="">Select Organization</option>
                    {orgs.map(o => (
                      <option key={o.id} value={o.id}>{o.orgName}</option>
                    ))}
                  </GlassSelect>
                ) : (
                  <div className="px-4 py-2.5 bg-white/50 border border-white/60 rounded-xl text-gray-700 font-medium shadow-sm backdrop-blur-sm flex items-center gap-2">
                    <Building2 size={16} className="text-indigo-500" />
                    {orgs.find(o => o.id === orgId)?.orgName || orgs[0]?.orgName || 'Loading...'}
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-[240px]">
                <GlassSelect 
                  value={periodId} 
                  onChange={(e: any) => updateFilter('period', e.target.value)} 
                  className="w-full"
                  icon={Calendar}
                >
                  <option value="">Select Period</option>
                  {periods.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.period_start} → {p.period_end} • {p.status.toUpperCase()}
                    </option>
                  ))}
                </GlassSelect>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={generatePayslips}
              disabled={isGenerating}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-semibold shadow-lg shadow-emerald-200 hover:shadow-emerald-300 transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <Sparkles size={18} />
              )}
              {isGenerating ? 'Generating...' : 'Generate Payslips'}
            </motion.button>
          </div>
        </GlassCard>

        {/* Filters & Export */}
        <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
          <div className="flex-1 w-full">
            <FilterBar 
              pageKey="payslips" 
              orgId={orgId} 
              config={filterConfig} 
            />
          </div>
          <ExportMenu 
            onExportCsv={() => handleExport('csv')} 
            onExportPdf={() => handleExport('pdf')} 
            isExporting={isExporting} 
          />
        </div>

        {/* Results Table */}
        <GlassCard className="min-h-[400px]">
          <AnimatePresence mode="wait">
            {items.length > 0 ? (
              <motion.div
                key="table"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <FileCheck size={20} className="text-emerald-500" />
                    Generated Payslips
                    <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full ml-2">
                      {totalItems} total
                    </span>
                  </h3>
                </div>
                
                <GlassTable columns={columns} rows={rows} />
                
                {/* Pagination */}
                <div className="flex items-center justify-between mt-6 px-2 border-t border-gray-100 pt-4">
                  <div className="text-sm text-gray-500">
                    Showing <span className="font-medium text-gray-900">{items.length}</span> of <span className="font-medium text-gray-900">{totalItems}</span> results
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => updateFilter('page', String(page - 1))}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      disabled={page * pageSize >= totalItems}
                      onClick={() => updateFilter('page', String(page + 1))}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <FileX size={48} className="text-gray-300" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Payslips Found</h3>
                <p className="text-gray-500 max-w-md mx-auto mb-6">
                  {periodId 
                    ? "We couldn't find any payslips for the selected criteria. Try adjusting your filters or generate new payslips."
                    : "Please select a payroll period above to view or generate payslips."}
                </p>
                {!periodId && (
                  <div className="text-sm text-indigo-500 font-medium animate-pulse">
                    ↑ Select a period to get started
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </motion.div>
    </AppShell>
  )
}
