'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'
import { normalizeRoleForApi } from '@lib/permissions'

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
  const [periodId, setPeriodId] = useState('')
  const [items, setItems] = useState<Payslip[]>([])
  const [role, setRole] = useState('')

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
    if (!periodId && list.length) setPeriodId(list[0].id)
  }

  const loadPayslips = async (oid: string, pid: string) => {
    if (!oid || !pid || !role) {
      setItems([])
      return
    }
    const headers: Record<string, string> = {}
    headers['x-role'] = role
    const res = await fetch(`/api/payslips?org_id=${encodeURIComponent(oid)}&period=${encodeURIComponent(pid)}`, {
      cache: 'no-store',
      headers
    })
    if (!res.ok) {
      setItems([])
      return
    }
    const d = await res.json()
    const list: Payslip[] = Array.isArray(d.items) ? d.items : []
    setItems(list)
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
    loadPayslips(orgId, periodId)
  }

  const exportCsv = () => {
    if (!orgId || !role || !periodId) {
      if (typeof window !== 'undefined') window.alert('Please select a payroll period before exporting.')
      return
    }
    const url = `/api/payslips/export/csv?org_id=${encodeURIComponent(orgId)}&period=${encodeURIComponent(periodId)}`
    window.open(url, '_blank')
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
    if (orgId) loadPeriods(orgId)
  }, [orgId])

  useEffect(() => {
    if (orgId && periodId) loadPayslips(orgId, periodId)
  }, [orgId, periodId, role])

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
            <GlassSelect value={periodId} onChange={(e: any) => setPeriodId(e.target.value)}>
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
            <GlassButton
              variant="primary"
              onClick={exportCsv}
              style={{ background: '#39FF14', borderColor: '#39FF14' }}
            >
              Export CSV
            </GlassButton>
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Payslips">
        <GlassTable columns={columns} rows={rows} />
      </GlassCard>
    </AppShell>
  )
}
