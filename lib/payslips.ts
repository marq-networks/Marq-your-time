import { isSupabaseConfigured, supabaseServer } from './supabase'
import { getOrganization, listAllOrgMembers, listDepartments } from './db'

type PayslipRecord = {
  id: string
  org_id: string
  user_id: string
  payroll_run_id: string
  slip_number: string
  pdf_path?: string | null
  created_at: string
}

type MemberPayrollRow = {
  id: string
  payroll_period_id: string
  member_id: string
  base_salary: number
  worked_minutes: number
  extra_minutes: number
  short_minutes: number
  overtime_amount: number
  short_deduction: number
  fines_total: number
  adjustments_total: number
  net_salary: number
  generated_at: string
  approved: boolean
  approved_at?: string | null
}

type PayrollPeriodV12Row = {
  id: string
  org_id: string
  period_start: string
  period_end: string
  status: string
  generated_at?: string | null
  approved_at?: string | null
  approved_by?: string | null
  created_by: string
  notes?: string | null
}

type PayslipListItem = {
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

type PayslipDetail = {
  payslipId: string
  slipNumber: string
  orgId: string
  orgName: string
  orgLogo?: string
  orgBillingEmail?: string
  employeeId: string
  employeeName: string
  employeeEmail: string
  employeeDepartment?: string
  employeeRoleTitle?: string
  employeeCode?: string
  periodStart: string
  periodEnd: string
  payDate: string
  baseSalary: number
  workedMinutes: number
  extraMinutes: number
  shortMinutes: number
  overtimeAmount: number
  shortDeduction: number
  finesTotal: number
  adjustmentsTotal: number
  netSalary: number
  currency: string
  generatedAt: string
}

const memPayslips: PayslipRecord[] = []

function isUuidLike(id: string) {
  return /^[0-9a-fA-F-]{32,36}$/.test(id)
}

function monthRange(ym: string) {
  const start = `${ym}-01`
  const base = new Date(`${ym}-01T00:00:00Z`)
  const next = new Date(base.getTime())
  next.setMonth(next.getMonth() + 1)
  const endDate = new Date(next.getTime() - 24 * 60 * 60 * 1000)
  const end = endDate.toISOString().slice(0, 10)
  return { start, end }
}

function nextSlipNumberFromExisting(existing: string[]): string {
  const numbers = existing
    .map(s => parseInt(String(s).replace(/[^0-9]/g, ''), 10))
    .filter(v => !isNaN(v))
  const max = numbers.length ? Math.max(...numbers) : 0
  const next = (max + 1).toString().padStart(5, '0')
  return `PSL-${next}`
}

export async function resolvePayrollPeriod(orgId: string, periodParam: string): Promise<PayrollPeriodV12Row | null> {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return null
  if (isUuidLike(periodParam)) {
    const { data } = await sb.from('payroll_periods_v12').select('*').eq('id', periodParam).maybeSingle()
    if (!data) return null
    return data as PayrollPeriodV12Row
  }
  if (!/^\d{4}-\d{2}$/.test(periodParam)) return null
  const { start, end } = monthRange(periodParam)
  const { data: rows } = await sb
    .from('payroll_periods_v12')
    .select('*')
    .eq('org_id', orgId)
    .gte('period_start', start)
    .lte('period_start', end)
    .in('status', ['approved', 'completed'])
    .order('period_start', { ascending: false })
    .limit(1)
  if (!rows || !rows.length) return null
  return rows[0] as PayrollPeriodV12Row
}

async function nextSlipNumber(orgId: string): Promise<string> {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) {
    const existing = memPayslips.filter(p => p.org_id === orgId).map(p => p.slip_number)
    return nextSlipNumberFromExisting(existing)
  }
  const { data } = await sb.from('payslips').select('slip_number').eq('org_id', orgId)
  const existing = (data || []).map((r: any) => String(r.slip_number || ''))
  return nextSlipNumberFromExisting(existing)
}

export async function generatePayslipsForPeriod(orgId: string, periodParam: string) {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return { error: 'SUPABASE_REQUIRED' as const }
  const period = await resolvePayrollPeriod(orgId, periodParam)
  if (!period) return { error: 'PERIOD_NOT_FOUND' as const }
  const { data: rows } = await sb
    .from('member_payroll')
    .select('*')
    .eq('payroll_period_id', period.id)
    .eq('approved', true)
  const payrollRows: MemberPayrollRow[] = (rows || []) as any
  if (!payrollRows.length) return { error: 'NO_APPROVED_ROWS' as const }
  const org = await getOrganization(orgId)
  if (!org) return { error: 'ORG_NOT_FOUND' as const }
  const memberIds = Array.from(new Set(payrollRows.map(r => String(r.member_id))))
  const { data: userRows } = await sb
    .from('users')
    .select('*')
    .in('id', memberIds)
  const users = (userRows || []) as any[]
  if (!users.length) return { error: 'USERS_NOT_FOUND' as const }
  const deps = await listDepartments(orgId)
  const userMap = new Map(users.map(u => [String(u.id), u]))
  const depMap = new Map(deps.map(d => [d.id, d.name]))
  const ym = period.period_start.slice(0, 7)
  const buckets = await sb.storage.listBuckets()
  const hasDocuments = (buckets.data || []).some((b: any) => b.name === 'documents')
  if (!hasDocuments) {
    await sb.storage.createBucket('documents', { public: false })
  }
  const bucket = sb.storage.from('documents')
  const created: string[] = []
  const failed: Array<{ id: string, reason: string }> = []
  for (const row of payrollRows) {
    const memberId = String(row.member_id)
    const user = userMap.get(memberId)
    if (!user) continue
    const { data: existing } = await sb
      .from('payslips')
      .select('*')
      .eq('org_id', orgId)
      .eq('user_id', memberId)
      .eq('payroll_run_id', period.id)
      .maybeSingle()
    let payslipId: string
    let slipNumber: string
    if (existing) {
      payslipId = String((existing as any).id)
      slipNumber = String((existing as any).slip_number)
    } else {
      slipNumber = await nextSlipNumber(orgId)
      const { data: inserted, error } = await sb
        .from('payslips')
        .insert({
          org_id: orgId,
          user_id: memberId,
          payroll_run_id: period.id,
          slip_number: slipNumber,
          created_at: new Date()
        })
        .select('*')
        .single()
      if (error || !inserted) continue
      payslipId = String(inserted.id)
    }
    const deptName = user.department_id ? depMap.get(user.department_id) || '' : ''
    const detail: PayslipDetail = {
      payslipId,
      slipNumber,
      orgId,
      orgName: org.orgName,
      orgLogo: org.orgLogo,
      orgBillingEmail: org.billingEmail,
      employeeId: user.id,
      employeeName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      employeeEmail: user.email,
      employeeDepartment: deptName,
      employeeRoleTitle: user.position_title,
      employeeCode: user.id,
      periodStart: period.period_start,
      periodEnd: period.period_end,
      payDate: (row.approved_at || row.generated_at || new Date().toISOString()).slice(0, 10),
      baseSalary: Number(row.base_salary || 0),
      workedMinutes: Number(row.worked_minutes || 0),
      extraMinutes: Number(row.extra_minutes || 0),
      shortMinutes: Number(row.short_minutes || 0),
      overtimeAmount: Number(row.overtime_amount || 0),
      shortDeduction: Number(row.short_deduction || 0),
      finesTotal: Number(row.fines_total || 0),
      adjustmentsTotal: Number(row.adjustments_total || 0),
      netSalary: Number(row.net_salary || 0),
      currency: 'USD',
      generatedAt: new Date().toISOString()
    }
    const html = renderPayslipHtml(detail)
    const filePath = `orgs/${orgId}/payslips/${ym}/${memberId}/${slipNumber}.pdf`
    const buffer = Buffer.from(html, 'utf8')
    const up = await bucket.upload(filePath, buffer, { contentType: 'text/html', upsert: true })
    if (up.error) {
      failed.push({ id: payslipId, reason: String(up.error.message || 'UPLOAD_ERROR') })
      continue
    }
    await sb.from('payslips').update({ pdf_path: filePath }).eq('id', payslipId)
    created.push(payslipId)
  }
  return { ok: true as const, created, failed }
}

export async function listPayslips(
  orgId: string,
  periodParam: string,
  options?: {
    userIds?: string[]
    page?: number
    pageSize?: number
    sort?: string
    q?: string
    status?: string // 'generated' (has pdf) | 'pending' (no pdf)
  }
): Promise<{ items: PayslipListItem[], total: number } | { error: string }> {
  const { userIds, page = 1, pageSize = 50, sort, q, status } = options || {}
  
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return { error: 'SUPABASE_REQUIRED' }

  const period = await resolvePayrollPeriod(orgId, periodParam)
  if (!period) return { error: 'PERIOD_NOT_FOUND' }

  // 1. Check if ANY payslips exist for this period to decide mode
  const { count: payslipCount } = await sb
    .from('payslips')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('payroll_run_id', period.id)

  const mode = (payslipCount || 0) > 0 ? 'payslips' : 'preview'
  const ym = period.period_start.slice(0, 7)

  // 2. Resolve 'q' to user IDs if provided
  let qUserIds: string[] | null = null
  if (q) {
    const { data: found } = await sb
      .from('users')
      .select('id')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
    qUserIds = (found || []).map(u => u.id)
  }

  // 3. Combine filters
  let finalUserIds = userIds
  if (qUserIds !== null) {
    if (finalUserIds) {
      finalUserIds = finalUserIds.filter(id => qUserIds!.includes(id))
    } else {
      finalUserIds = qUserIds
    }
  }

  // 4. Build Query
  let query = sb.from(mode === 'payslips' ? 'payslips' : 'member_payroll').select('*', { count: 'exact' })

  if (mode === 'payslips') {
    query = query.eq('org_id', orgId).eq('payroll_run_id', period.id)
    if (finalUserIds && finalUserIds.length > 0) {
      query = query.in('user_id', finalUserIds)
    } else if (finalUserIds && finalUserIds.length === 0) {
      return { items: [], total: 0 }
    }

    if (status === 'generated') {
      query = query.not('pdf_path', 'is', null)
    } else if (status === 'pending') {
      query = query.is('pdf_path', null)
    } else if (status === 'sent') {
      query = query.not('sent_at', 'is', null)
    } else if (status === 'paid') {
      query = query.not('paid_at', 'is', null)
    }
  } else {
    query = query.eq('payroll_period_id', period.id).eq('approved', true)
    if (finalUserIds && finalUserIds.length > 0) {
      query = query.in('member_id', finalUserIds)
    } else if (finalUserIds && finalUserIds.length === 0) {
      return { items: [], total: 0 }
    }
  }

  // 5. Sort
  if (sort) {
    const [field, dir] = sort.split(':')
    const asc = dir === 'asc'
    if (field === 'created_at') {
      query = query.order(mode === 'payslips' ? 'created_at' : 'generated_at', { ascending: asc })
    } else if (field === 'amount') {
      query = query.order('net_salary', { ascending: asc })
    } else {
      query = query.order(mode === 'payslips' ? 'created_at' : 'generated_at', { ascending: false })
    }
  } else {
    query = query.order(mode === 'payslips' ? 'created_at' : 'generated_at', { ascending: false })
  }

  // 6. Pagination
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data: rows, count, error } = await query
  if (error) return { error: error.message }
  if (!rows || rows.length === 0) return { items: [], total: 0 }

  // 7. Fetch details for mapping
  const rowUserIds = Array.from(new Set(rows.map((r: any) => String(mode === 'payslips' ? r.user_id : r.member_id))))
  const { data: usersData } = await sb.from('users').select('id, first_name, last_name, department_id, email').in('id', rowUserIds)
  const { data: deptsData } = await sb.from('departments').select('id, name').eq('org_id', orgId)
  
  const userMap = new Map((usersData || []).map((u: any) => [u.id, u]))
  const depMap = new Map((deptsData || []).map((d: any) => [d.id, d.name]))

  // 8. Map results
  // We need to fetch member_payroll for 'payslips' mode to get net_salary if it's not in payslips table?
  // Checking types:
  // PayslipRecord has NO net_salary. It has `payroll_run_id` and `user_id`.
  // MemberPayrollRow HAS `net_salary`.
  // The original implementation fetched member_payroll rows to get amounts for payslips mode too.
  
  let payrollMap = new Map<string, MemberPayrollRow>()
  if (mode === 'payslips') {
    const { data: prRows } = await sb
      .from('member_payroll')
      .select('*')
      .eq('payroll_period_id', period.id)
      .in('member_id', rowUserIds)
    
    payrollMap = new Map((prRows || []).map((r: any) => [String(r.member_id), r]))
  }

  const items = rows.map((r: any) => {
    const userId = String(mode === 'payslips' ? r.user_id : r.member_id)
    const user = userMap.get(userId)
    const deptName = user && user.department_id ? depMap.get(user.department_id) || '' : ''
    const name = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : userId
    
    let net = 0
    if (mode === 'payslips') {
      const pr = payrollMap.get(userId)
      net = pr ? Number(pr.net_salary || 0) : 0
    } else {
      net = Number(r.net_salary || 0)
    }

    return {
      id: r.id,
      slipNumber: mode === 'payslips' ? r.slip_number : '-',
      userId,
      employeeName: name,
      departmentName: deptName,
      payrollPeriodId: period.id,
      periodStart: period.period_start,
      periodEnd: period.period_end,
      netSalary: net,
      currency: 'USD',
      hasPdf: mode === 'payslips' ? !!r.pdf_path : false,
      createdAt: (mode === 'payslips' ? r.created_at : r.generated_at) || `${ym}-01`
    }
  })

  return { items, total: count || 0 }
}

export async function getPayslipDetail(payslipId: string): Promise<PayslipDetail | null> {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return null
  const { data: payslip } = await sb.from('payslips').select('*').eq('id', payslipId).maybeSingle()
  if (!payslip) return null
  const rec = payslip as PayslipRecord
  const org = await getOrganization(rec.org_id)
  if (!org) return null
  const { data: periodRow } = await sb
    .from('payroll_periods_v12')
    .select('*')
    .eq('id', rec.payroll_run_id)
    .maybeSingle()
  if (!periodRow) return null
  const period = periodRow as PayrollPeriodV12Row
  const { data: payrollRow } = await sb
    .from('member_payroll')
    .select('*')
    .eq('payroll_period_id', period.id)
    .eq('member_id', rec.user_id)
    .maybeSingle()
  if (!payrollRow) return null
  const row = payrollRow as MemberPayrollRow
  const users = await listAllOrgMembers(rec.org_id)
  const deps = await listDepartments(rec.org_id)
  const user = users.find(u => u.id === rec.user_id)
  const dep = user && user.departmentId ? deps.find(d => d.id === user.departmentId) : undefined
  const payDate = (row.approved_at || row.generated_at || rec.created_at).slice(0, 10)
  const currency = 'USD'
  return {
    payslipId: rec.id,
    slipNumber: rec.slip_number,
    orgId: rec.org_id,
    orgName: org.orgName,
    orgLogo: org.orgLogo,
    orgBillingEmail: org.billingEmail,
    employeeId: rec.user_id,
    employeeName: user ? `${user.firstName} ${user.lastName}`.trim() : String(rec.user_id),
    employeeEmail: user ? user.email : '',
    employeeDepartment: dep ? dep.name : undefined,
    employeeRoleTitle: user ? user.positionTitle : undefined,
    employeeCode: user ? user.id : undefined,
    periodStart: period.period_start,
    periodEnd: period.period_end,
    payDate,
    baseSalary: Number(row.base_salary || 0),
    workedMinutes: Number(row.worked_minutes || 0),
    extraMinutes: Number(row.extra_minutes || 0),
    shortMinutes: Number(row.short_minutes || 0),
    overtimeAmount: Number(row.overtime_amount || 0),
    shortDeduction: Number(row.short_deduction || 0),
    finesTotal: Number(row.fines_total || 0),
    adjustmentsTotal: Number(row.adjustments_total || 0),
    netSalary: Number(row.net_salary || 0),
    currency,
    generatedAt: rec.created_at
  }
}

export function renderPayslipHtml(detail: PayslipDetail): string {
  const fmtCurrency = (v: number) => {
    const val = Math.round((v || 0) * 100) / 100
    return `${detail.currency} ${val.toFixed(2)}`
  }
  const fmtHM = (mins: number) => {
    const m = Math.max(0, Math.round(mins || 0))
    const h = Math.floor(m / 60)
    const mm = String(m % 60).padStart(2, '0')
    return `${h}:${mm}`
  }
  const issuedOn = detail.generatedAt.slice(0, 10)
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    "<meta charset='utf-8' />",
    `<title>Payslip ${detail.slipNumber}</title>`,
    "<style>",
    'body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding:24px; color:#111827; }',
    '.header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }',
    '.org-name { font-size:20px; font-weight:600; }',
    '.payslip-title { font-size:18px; font-weight:600; text-align:right; }',
    '.muted { color:#6b7280; font-size:12px; }',
    '.section { border:1px solid #e5e7eb; border-radius:8px; padding:12px 16px; margin-bottom:12px; }',
    '.section-title { font-size:14px; font-weight:600; margin-bottom:8px; }',
    '.grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; }',
    '.row { display:flex; justify-content:space-between; font-size:12px; margin:2px 0; }',
    '.label { color:#6b7280; }',
    '.value { font-weight:500; }',
    '.totals { margin-top:8px; }',
    '.net { font-size:16px; font-weight:700; color:#111827; }',
    '.footer { margin-top:24px; font-size:11px; color:#6b7280; }',
    '.notes { margin-top:4px; }',
    "</style>",
    '</head>',
    '<body>',
    "<div class='header'>",
    "<div>",
    `<div class='org-name'>${detail.orgName}</div>`,
    detail.orgBillingEmail ? `<div class='muted'>${detail.orgBillingEmail}</div>` : '',
    "</div>",
    "<div>",
    "<div class='payslip-title'>Salary Payslip</div>",
    `<div class='muted'>Slip No: ${detail.slipNumber}</div>`,
    `<div class='muted'>Pay Period: ${detail.periodStart} to ${detail.periodEnd}</div>`,
    `<div class='muted'>Pay Date: ${detail.payDate}</div>`,
    "</div>",
    "</div>",
    "<div class='section'>",
    "<div class='section-title'>Employee Details</div>",
    "<div class='grid-2'>",
    "<div>",
    "<div class='row'><span class='label'>Name</span><span class='value'>",
    detail.employeeName,
    "</span></div>",
    "<div class='row'><span class='label'>Email</span><span class='value'>",
    detail.employeeEmail,
    "</span></div>",
    "<div class='row'><span class='label'>Employee ID</span><span class='value'>",
    detail.employeeCode || detail.employeeId,
    "</span></div>",
    "</div>",
    "<div>",
    "<div class='row'><span class='label'>Department</span><span class='value'>",
    detail.employeeDepartment || '',
    "</span></div>",
    "<div class='row'><span class='label'>Role</span><span class='value'>",
    detail.employeeRoleTitle || '',
    "</span></div>",
    "<div class='row'><span class='label'>Payment Type</span><span class='value'>Salary</span></div>",
    "</div>",
    "</div>",
    "</div>",
    "<div class='section'>",
    "<div class='section-title'>Earnings</div>",
    "<div class='row'><span class='label'>Base Pay</span><span class='value'>",
    fmtCurrency(detail.baseSalary),
    "</span></div>",
    "<div class='row'><span class='label'>Overtime Pay</span><span class='value'>",
    fmtCurrency(detail.overtimeAmount),
    "</span></div>",
    "<div class='row'><span class='label'>Adjustments (Positive)</span><span class='value'>",
    fmtCurrency(detail.adjustmentsTotal > 0 ? detail.adjustmentsTotal : 0),
    "</span></div>",
    "</div>",
    "<div class='section'>",
    "<div class='section-title'>Deductions</div>",
    "<div class='row'><span class='label'>Short Time Deduction</span><span class='value'>",
    fmtCurrency(detail.shortDeduction),
    "</span></div>",
    "<div class='row'><span class='label'>Fines / Penalties</span><span class='value'>",
    fmtCurrency(detail.finesTotal),
    "</span></div>",
    "<div class='row'><span class='label'>Adjustments (Negative)</span><span class='value'>",
    fmtCurrency(detail.adjustmentsTotal < 0 ? -detail.adjustmentsTotal : 0),
    "</span></div>",
    "</div>",
    "<div class='section'>",
    "<div class='section-title'>Attendance Summary</div>",
    "<div class='grid-2'>",
    "<div>",
    "<div class='row'><span class='label'>Total Hours Worked</span><span class='value'>",
    fmtHM(detail.workedMinutes),
    "</span></div>",
    "<div class='row'><span class='label'>Overtime Hours</span><span class='value'>",
    fmtHM(detail.extraMinutes),
    "</span></div>",
    "</div>",
    "<div>",
    "<div class='row'><span class='label'>Shortfall Hours</span><span class='value'>",
    fmtHM(detail.shortMinutes),
    "</span></div>",
    "</div>",
    "</div>",
    "</div>",
    "<div class='section totals'>",
    "<div class='row'><span class='label'>Gross Pay (Base + Overtime + Positive Adjustments)</span><span class='value'>",
    fmtCurrency(detail.baseSalary + detail.overtimeAmount + (detail.adjustmentsTotal > 0 ? detail.adjustmentsTotal : 0)),
    "</span></div>",
    "<div class='row'><span class='label'>Total Deductions</span><span class='value'>",
    fmtCurrency(detail.shortDeduction + detail.finesTotal + (detail.adjustmentsTotal < 0 ? -detail.adjustmentsTotal : 0)),
    "</span></div>",
    "<div class='row'><span class='label net'>Net Pay</span><span class='net'>",
    fmtCurrency(detail.netSalary),
    "</span></div>",
    "</div>",
    "<div class='footer'>",
    "<div>Notes: This payslip is generated based on finalized payroll results.</div>",
    "<div class='notes'>This is a system-generated payslip. No signature is required.</div>",
    `<div class='muted'>Issued on ${issuedOn}</div>`,
    "</div>",
    "</body>",
    "</html>"
  ].join('')
}
