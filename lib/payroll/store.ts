import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { publishNotification, getOrganization, listUsers, listTeamMemberIds, generatePayrollLines, listPayrollLines } from '@lib/db'
import { sendMail } from '@lib/mailer'
import { queueWebhookEvent } from '@lib/webhooks/queue'

export type PeriodStatusV12 = 'pending' | 'processing' | 'approved' | 'completed'
export interface PayrollPeriodV12 {
  id: string
  org_id: string
  period_start: string
  period_end: string
  status: PeriodStatusV12
  generated_at?: string
  approved_at?: string
  approved_by?: string | null
  created_by: string
  notes?: string | null
}

export interface MemberPayrollRow {
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

export interface PayrollAdjustmentRow {
  id: string
  member_payroll_id: string
  type: 'bonus' | 'deduction' | 'fine'
  amount: number
  reason: string
  created_at: string
  created_by: string
}

const memPeriods: PayrollPeriodV12[] = []
const memRows: MemberPayrollRow[] = []
const memAdjustments: PayrollAdjustmentRow[] = []

export async function createPeriod(input: { org_id: string, period_start: string, period_end: string, created_by: string, notes?: string }) {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('payroll_periods_v12').insert({ org_id: input.org_id, period_start: input.period_start, period_end: input.period_end, status: 'pending', created_by: input.created_by, notes: input.notes ?? null }).select('*').single()
    if (error) return 'DB_ERROR'
    await publishNotification({ orgId: input.org_id, type: 'payroll', title: 'Payroll period created', message: `Period ${input.period_start} to ${input.period_end}`, meta: { url: `/payroll` } })
    const org = await getOrganization(input.org_id)
    if (org?.billingEmail) await sendMail(org.billingEmail, 'Payroll period created', `<div>Payroll period created for ${org.orgName}: ${input.period_start} to ${input.period_end}</div>`)
    return data as PayrollPeriodV12
  }
  const p: PayrollPeriodV12 = { id: cryptoRandom(), org_id: input.org_id, period_start: input.period_start, period_end: input.period_end, status: 'pending', created_by: input.created_by, notes: input.notes ?? null }
  memPeriods.push(p)
  return p
}

export async function listPeriods(org_id: string, limit = 50, cursor?: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    let q = sb.from('payroll_periods_v12').select('*').eq('org_id', org_id).order('period_start', { ascending: false }).limit(limit)
    if (cursor) q = q.lt('period_start', cursor)
    const { data } = await q
    const nextCursor = (data || []).length ? (data![data!.length-1] as any).period_start : null
    return { items: (data || []) as PayrollPeriodV12[], nextCursor }
  }
  const sorted = memPeriods.filter(p => p.org_id === org_id).sort((a,b)=> b.period_start.localeCompare(a.period_start))
  const items = sorted.slice(0, limit)
  const nextCursor = items.length ? items[items.length-1].period_start : null
  return { items, nextCursor }
}

export async function setPeriodStatus(id: string, status: PeriodStatusV12, byUserId?: string) {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const patch: any = { status }
    if (status === 'processing') patch.generated_at = now
    if (status === 'approved') { patch.approved_at = now; patch.approved_by = byUserId ?? null }
    const { data, error } = await sb.from('payroll_periods_v12').update(patch).eq('id', id).select('*').single()
    if (error) return 'DB_ERROR'
    if (status === 'approved' && data?.org_id) { try { await queueWebhookEvent(String(data.org_id), 'payroll.period_approved', { payroll_period_id: id, org_id: String(data.org_id), approved_by: byUserId ?? null, approved_at: patch.approved_at }) } catch {} }
    return data as PayrollPeriodV12
  }
  const p = memPeriods.find(x => x.id === id)
  if (!p) return 'NOT_FOUND'
  p.status = status
  if (status === 'processing') p.generated_at = now.toISOString()
  if (status === 'approved') { p.approved_at = now.toISOString(); p.approved_by = byUserId ?? null }
  if (status === 'approved') { try { await queueWebhookEvent(p.org_id, 'payroll.period_approved', { payroll_period_id: id, org_id: p.org_id, approved_by: byUserId ?? null, approved_at: p.approved_at }) } catch {} }
  return p
}

export async function listMemberRows(payroll_period_id: string) {
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data } = await sb.from('member_payroll').select('*').eq('payroll_period_id', payroll_period_id)
    return (data || []) as MemberPayrollRow[]
  }
  return memRows.filter(r => r.payroll_period_id === payroll_period_id)
}

export async function addAdjustment(input: { member_payroll_id: string, type: 'bonus'|'deduction'|'fine', amount: number, reason: string, created_by: string }) {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data, error } = await sb.from('payroll_adjustments').insert({ member_payroll_id: input.member_payroll_id, type: input.type, amount: input.amount, reason: input.reason, created_at: now, created_by: input.created_by }).select('*').single()
    if (error) return 'DB_ERROR'
    const { data: row } = await sb.from('member_payroll').select('*').eq('id', input.member_payroll_id).single()
    if (row) {
      const adjTotal = Number(row.adjustments_total || 0) + (input.type === 'deduction' || input.type === 'fine' ? -Math.abs(input.amount) : Math.abs(input.amount))
      const net = Number(row.base_salary||0) + Number(row.overtime_amount||0) - Number(row.short_deduction||0) - Number(row.fines_total||0) + adjTotal
      await sb.from('member_payroll').update({ adjustments_total: adjTotal, net_salary: net }).eq('id', input.member_payroll_id)
    }
    return data as PayrollAdjustmentRow
  }
  const a: PayrollAdjustmentRow = { id: cryptoRandom(), member_payroll_id: input.member_payroll_id, type: input.type, amount: input.amount, reason: input.reason, created_at: now.toISOString(), created_by: input.created_by }
  memAdjustments.push(a)
  const row = memRows.find(r => r.id === input.member_payroll_id)
  if (row) {
    const delta = input.type === 'deduction' || input.type === 'fine' ? -Math.abs(input.amount) : Math.abs(input.amount)
    row.adjustments_total = Number(row.adjustments_total || 0) + delta
    row.net_salary = Number(row.base_salary||0) + Number(row.overtime_amount||0) - Number(row.short_deduction||0) - Number(row.fines_total||0) + Number(row.adjustments_total||0)
  }
  return a
}

export async function approveAll(payroll_period_id: string, approver_id: string, org_id: string) {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    const { data: rows } = await sb.from('member_payroll').select('id, member_id').eq('payroll_period_id', payroll_period_id)
    for (const r of (rows || []) as any[]) await sb.from('member_payroll').update({ approved: true, approved_at: now }).eq('id', r.id)
    await setPeriodStatus(payroll_period_id, 'approved', approver_id)
    for (const r of (rows || []) as any[]) await publishNotification({ orgId: org_id, memberId: r.member_id, type: 'payroll', title: 'Payslip available', message: 'Your payslip is available.' })
    const users = await listUsers(org_id)
    const emailMap = new Map(users.map(u => [u.id, u.email]))
    for (const r of (rows || []) as any[]) {
      const to = emailMap.get((r as any).member_id)
      if (to) await sendMail(to, 'Payslip available', `<div>Your payslip is available for review.</div>`)
    }
    const org = await getOrganization(org_id)
    if (org?.billingEmail) await sendMail(org.billingEmail, 'Payroll approved', `<div>Payroll approved for ${org.orgName}</div>`)
    return { approved: (rows || []).length }
  }
  const rows = memRows.filter(r => r.payroll_period_id === payroll_period_id)
  for (const r of rows) { r.approved = true; r.approved_at = now.toISOString() }
  await setPeriodStatus(payroll_period_id, 'approved', approver_id)
  for (const r of rows) await publishNotification({ orgId: org_id, memberId: r.member_id, type: 'payroll', title: 'Payslip available', message: 'Your payslip is available.' })
  const users = await listUsers(org_id)
  const emailMap = new Map(users.map(u => [u.id, u.email]))
  for (const r of rows) {
    const to = emailMap.get(r.member_id)
    if (to) await sendMail(to, 'Payslip available', `<div>Your payslip is available for review.</div>`)
  }
  return { approved: rows.length }
}

export async function approveForTeam(payroll_period_id: string, approver_id: string, org_id: string, memberIds: string[]) {
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    if (!memberIds || memberIds.length === 0) return { approved: 0 }
    const { data: rows } = await sb.from('member_payroll').select('id, member_id').eq('payroll_period_id', payroll_period_id).in('member_id', memberIds)
    for (const r of (rows || []) as any[]) await sb.from('member_payroll').update({ approved: true, approved_at: now }).eq('id', r.id)
    for (const r of (rows || []) as any[]) await publishNotification({ orgId: org_id, memberId: r.member_id, type: 'payroll', title: 'Payslip available', message: 'Your payslip is available.' })
    const users = await listUsers(org_id)
    const emailMap = new Map(users.map(u => [u.id, u.email]))
    for (const r of (rows || []) as any[]) {
      const to = emailMap.get((r as any).member_id)
      if (to) await sendMail(to, 'Payslip available', `<div>Your payslip is available for review.</div>`)
    }
    return { approved: (rows || []).length }
  }
  const rows = memRows.filter(r => r.payroll_period_id === payroll_period_id && memberIds.includes(r.member_id))
  for (const r of rows) { r.approved = true; r.approved_at = now.toISOString() }
  for (const r of rows) await publishNotification({ orgId: org_id, memberId: r.member_id, type: 'payroll', title: 'Payslip available', message: 'Your payslip is available.' })
  const users = await listUsers(org_id)
  const emailMap = new Map(users.map(u => [u.id, u.email]))
  for (const r of rows) {
    const to = emailMap.get(r.member_id)
    if (to) await sendMail(to, 'Payslip available', `<div>Your payslip is available for review.</div>`)
  }
  return { approved: rows.length }
}

export async function generateForPeriod(payroll_period_id: string, org_id: string) {
  await setPeriodStatus(payroll_period_id, 'processing')
  const res = await generatePayrollLines(org_id, payroll_period_id)
  if (typeof res === 'string' && res !== 'OK') return res
  const lines = await listPayrollLines(payroll_period_id)
  const now = new Date()
  if (isSupabaseConfigured()) {
    const sb = supabaseServer()
    for (const l of lines as any[]) {
      const base_salary = Number(l.baseEarnings || 0)
      const worked_minutes = Number(l.totalWorkedMinutes || 0)
      const extra_minutes = Number(l.totalExtraMinutes || 0)
      const short_minutes = Number(l.totalShortMinutes || 0)
      const overtime_amount = Number(l.extraEarnings || 0)
      const short_deduction = Number(l.deductionForShort || 0)
      const fines_total = Number(l.finesTotal || 0)
      const adjustments_total = Number(l.adjustmentsTotal || 0)
      const net_salary = Number(l.netPayable || 0)
      const payload = { payroll_period_id: payroll_period_id, member_id: l.memberId, base_salary, worked_minutes, extra_minutes, short_minutes, overtime_amount, short_deduction, fines_total, adjustments_total, net_salary, generated_at: now, approved: false, approved_at: null }
      const { data: existing } = await sb.from('member_payroll').select('id').eq('payroll_period_id', payroll_period_id).eq('member_id', l.memberId).limit(1).maybeSingle()
      if (existing) await sb.from('member_payroll').update(payload).eq('id', (existing as any).id)
      else await sb.from('member_payroll').insert(payload)
    }
    await publishNotification({ orgId: org_id, type: 'payroll', title: 'Payroll generated', message: `Payroll generated for period ${payroll_period_id}` })
    const org = await getOrganization(org_id)
    if (org?.billingEmail) await sendMail(org.billingEmail, 'Payroll generated', `<div>Payroll generated for ${org.orgName}</div>`)
    return 'OK'
  }
  memRows.splice(0, memRows.length)
  for (const l of lines as any[]) {
    memRows.push({
      id: cryptoRandom(),
      payroll_period_id,
      member_id: l.memberId,
      base_salary: Number(l.baseEarnings || 0),
      worked_minutes: Number(l.totalWorkedMinutes || 0),
      extra_minutes: Number(l.totalExtraMinutes || 0),
      short_minutes: Number(l.totalShortMinutes || 0),
      overtime_amount: Number(l.extraEarnings || 0),
      short_deduction: Number(l.deductionForShort || 0),
      fines_total: Number(l.finesTotal || 0),
      adjustments_total: Number(l.adjustmentsTotal || 0),
      net_salary: Number(l.netPayable || 0),
      generated_at: now.toISOString(),
      approved: false,
      approved_at: null
    })
  }
  await publishNotification({ orgId: org_id, type: 'payroll', title: 'Payroll generated', message: `Payroll generated for period ${payroll_period_id}` })
  return 'OK'
}

export function cryptoRandom() { return 'id-' + Math.random().toString(36).slice(2) }
