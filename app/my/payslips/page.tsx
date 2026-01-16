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

export default function MyPayslipsPage() {
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
    if (!oid || !pid) {
      setItems([])
      return
    }
    const res = await fetch(`/api/my/payslips?org_id=${encodeURIComponent(oid)}&period=${encodeURIComponent(pid)}`, {
      cache: 'no-store'
    })
    if (!res.ok) {
      setItems([])
      return
    }
    const d = await res.json()
    const list: Payslip[] = Array.isArray(d.items) ? d.items : []
    setItems(list)
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
    if (role && ['employee', 'member', 'admin', 'owner', 'manager', 'finance', 'super_admin'].includes(role)) {
      loadOrgs()
    }
  }, [role])

  useEffect(() => {
    if (orgId) loadPeriods(orgId)
  }, [orgId])

  useEffect(() => {
    if (orgId && periodId) loadPayslips(orgId, periodId)
  }, [orgId, periodId])

  const columns = ['Period', 'Net Salary', 'Slip', 'Created', 'Actions']
  const rows = items.map(p => [
    `${p.periodStart} → ${p.periodEnd}`,
    fmtCurrency(p.netSalary, p.currency),
    p.slipNumber,
    new Date(p.createdAt).toLocaleString(),
    <div className="row" style={{ gap: 8 }}>
      <GlassButton
        variant="primary"
        onClick={() => window.open(`/api/payslips/${p.id}/pdf`, '_blank')}
        style={{ background: '#39FF14', borderColor: '#39FF14' }}
      >
        View Payslip
      </GlassButton>
    </div>
  ])

  return (
    <AppShell title="My Payslips">
      <GlassCard title="Select Period">
        <div className="grid grid-3">
          <div>
            <div className="label">Organization</div>
            {['employee', 'member'].includes(role) ? (
              <span className="tag-pill">
                {orgs.find(o => o.id === orgId)?.orgName || orgs[0]?.orgName || ''}
              </span>
            ) : (
              <GlassSelect value={orgId} onChange={(e: any) => setOrgId(e.target.value)}>
                <option value="">Select org</option>
                {orgs.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.orgName}
                  </option>
                ))}
              </GlassSelect>
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
        </div>
      </GlassCard>

      <GlassCard title="My Payslips">
        <GlassTable columns={columns} rows={rows} />
      </GlassCard>
    </AppShell>
  )
}

