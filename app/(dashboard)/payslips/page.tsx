'use client'
import { useEffect, useState, useMemo } from 'react'
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
    const headers: Record<string, string> = {}
    headers['x-role'] = role
    const res = await fetch(
      `/api/payslips/generate?org_id=${encodeURIComponent(orgId)}&period=${encodeURIComponent(periodId)}`,
      {
        method: 'POST',
        headers
      }
    )
    if (!res.ok) {
      try {
        const data = await res.json()
        const raw = typeof data?.error === 'string' ? data.error : ''
        const msg =
          raw === 'NO_APPROVED_ROWS'
            ? 'No approved payroll rows for this period. Open Payroll v12, generate payroll for this period, approve it, then try again.'
            : raw || 'Failed to generate payslips'
        if (typeof window !== 'undefined') window.alert(msg)
      } catch {
        if (typeof window !== 'undefined') window.alert('Failed to generate payslips')
      }
      return
    }
    loadPayslips()
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

  const columns = ['Employee', 'Department', 'Period', 'Net Salary', 'Slip', 'Created', 'Actions']
  const rows = items.map(p => [
    p.employeeName,
    p.departmentName || '',
    `${p.periodStart} → ${p.periodEnd}`,
    fmtCurrency(p.netSalary, p.currency),
    p.slipNumber,
    new Date(p.createdAt).toLocaleString(),
    <div className="row" style={{ gap: 8 }}>
      <GlassButton
        variant="primary"
        disabled={!p.hasPdf}
        onClick={() => p.hasPdf && window.open(`/api/payslips/${p.id}/pdf`, '_blank')}
        style={{
          background: p.hasPdf ? '#39FF14' : '#9CA3AF',
          borderColor: p.hasPdf ? '#39FF14' : '#9CA3AF'
        }}
      >
        {p.hasPdf ? 'View Payslip' : 'No PDF'}
      </GlassButton>
    </div>
  ])

  return (
    <AppShell title="Payslips">
      <GlassCard title="Select Period">
        <div className="grid grid-3">
          <div>
            <div className="label">Organization</div>
            {role === 'super_admin' ? (
              <GlassSelect value={orgId} onChange={(e: any) => setOrgId(e.target.value)}>
                <option value="">Select org</option>
                {orgs.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.orgName}
                  </option>
                ))}
              </GlassSelect>
            ) : (
              <span className="tag-pill">
                {orgs.find(o => o.id === orgId)?.orgName || orgs[0]?.orgName || ''}
              </span>
            )}
          </div>
          <div>
            <div className="label">Payroll Period</div>
            <GlassSelect value={periodId} onChange={(e: any) => updateFilter('period', e.target.value)}>
              <option value="">Select period</option>
              {periods.map(p => (
                <option key={p.id} value={p.id}>
                  {p.period_start} → {p.period_end} [{p.status}]
                </option>
              ))}
            </GlassSelect>
          </div>
          <div className="row" style={{ alignItems: 'end', gap: 8 }}>
            <GlassButton
              variant="primary"
              onClick={generatePayslips}
              style={{ background: '#39FF14', borderColor: '#39FF14' }}
            >
              Generate Payslips
            </GlassButton>
          </div>
        </div>
      </GlassCard>

      <div className="flex flex-col md:flex-row gap-4 items-start justify-between mb-6">
        <div className="flex-1 w-full">
          <FilterBar 
            pageKey="payslips" 
            orgId={orgId} 
            config={filterConfig} 
          />
        </div>
        <div className="mt-0 md:mt-0">
          <ExportMenu 
            onExportCsv={() => handleExport('csv')} 
            onExportPdf={() => handleExport('pdf')} 
            isExporting={isExporting} 
          />
        </div>
      </div>

      <GlassCard title="Payslips">
        <GlassTable columns={columns} rows={rows} />
        
        {/* Pagination Controls */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm opacity-60">
            Showing {items.length} of {totalItems} items
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
      </GlassCard>
    </AppShell>
  )
}
