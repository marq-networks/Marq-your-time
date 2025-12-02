import { isSupabaseConfigured, supabaseServer } from './supabase'
import { newId } from './token'
import { listDailyLogs } from './db'

type Invoice = {
  id: string
  orgId: string
  invoiceNumber: string
  invoiceDate: string
  billingPeriodStart: string
  billingPeriodEnd: string
  subtotal: number
  tax: number
  total: number
  status: 'paid'|'unpaid'|'overdue'
  pdfUrl?: string
  createdAt: number
  updatedAt: number
}

type LineItem = {
  id: string
  invoiceId: string
  title: string
  description?: string
  quantity: number
  unitPrice: number
  total: number
}

const memInvoices: Invoice[] = []
const memLines: LineItem[] = []
const TAX_RATE = 0.10

function nextInvoiceNumber(numbers: string[]): string {
  const vals = numbers.map(n => parseInt(String(n).replace(/[^0-9]/g,''), 10)).filter(v => !isNaN(v))
  const max = vals.length ? Math.max(...vals) : 0
  const next = (max + 1).toString().padStart(5,'0')
  return `INV-${next}`
}

export async function createInvoice(input: { orgId: string, invoiceDate: string, periodStart: string, periodEnd: string, basePrice: number, perLoginCost: number, manualItems?: { title: string, description?: string, quantity: number, unitPrice: number }[] }) {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  const today = new Date()
  // Pull attendance/usage from Module 4 daily summaries via listDailyLogs
  const { summaries } = await listDailyLogs({ orgId: input.orgId, date: input.periodEnd })
  const totalDaysPresent = (summaries || []).reduce((s, r) => s + (r.workedMinutes > 0 ? 1 : 0), 0)
  const totalWorkedMinutes = (summaries || []).reduce((s, r) => s + r.workedMinutes, 0)
  const workedHours = Math.round(totalWorkedMinutes / 60)
  const existingNumbers = sb ? (await sb.from('billing_invoices').select('invoice_number').eq('org_id', input.orgId)).data?.map((r:any)=>r.invoice_number) || [] : memInvoices.filter(i => i.orgId===input.orgId).map(i => i.invoiceNumber)
  const invoiceNumber = nextInvoiceNumber(existingNumbers)
  // Build line items: base price, per-login usage, tracked hours (unitPrice 0), plus manual items
  const items: LineItem[] = []
  const invId = sb ? newId() : newId()
  items.push({ id: newId(), invoiceId: invId, title: 'Base Subscription', description: 'Organization base price', quantity: 1, unitPrice: input.basePrice, total: input.basePrice })
  items.push({ id: newId(), invoiceId: invId, title: 'Per-login Usage', description: 'Days present in period', quantity: totalDaysPresent, unitPrice: input.perLoginCost, total: totalDaysPresent * input.perLoginCost })
  items.push({ id: newId(), invoiceId: invId, title: 'Tracked Hours (Module 6)', description: 'Total worked hours attached from payroll/time summaries', quantity: workedHours, unitPrice: 0, total: 0 })
  for (const m of (input.manualItems || [])) items.push({ id: newId(), invoiceId: invId, title: m.title, description: m.description, quantity: m.quantity, unitPrice: m.unitPrice, total: m.quantity * m.unitPrice })
  const subtotal = items.reduce((s,i)=> s + i.total, 0)
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100
  const total = Math.round((subtotal + tax) * 100) / 100
  if (sb) {
    const { data: invRow, error: invErr } = await sb.from('billing_invoices').insert({ id: invId, org_id: input.orgId, invoice_number: invoiceNumber, invoice_date: input.invoiceDate, billing_period_start: input.periodStart, billing_period_end: input.periodEnd, subtotal, tax, total, status: 'unpaid', created_at: today, updated_at: today, pdf_url: null }).select('*').single()
    if (invErr) return 'DB_ERROR'
    const rows = items.map(i => ({ id: i.id, invoice_id: invId, title: i.title, description: i.description ?? null, quantity: i.quantity, unit_price: i.unitPrice, total: i.total }))
    const { error: liErr } = await sb.from('billing_line_items').insert(rows)
    if (liErr) return 'DB_ERROR'
  } else {
    memInvoices.push({ id: invId, orgId: input.orgId, invoiceNumber, invoiceDate: input.invoiceDate, billingPeriodStart: input.periodStart, billingPeriodEnd: input.periodEnd, subtotal, tax, total, status: 'unpaid', createdAt: today.getTime(), updatedAt: today.getTime() })
    memLines.push(...items)
  }
  return { id: invId, invoiceNumber }
}

export async function getInvoices(orgId: string) {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (sb) {
    const { data } = await sb.from('billing_invoices').select('*').eq('org_id', orgId).order('invoice_date', { ascending: false })
    return (data || []).map((r:any)=> ({ id:r.id, orgId:r.org_id, invoiceNumber:r.invoice_number, invoiceDate:r.invoice_date, billingPeriodStart:r.billing_period_start, billingPeriodEnd:r.billing_period_end, subtotal:Number(r.subtotal), tax:Number(r.tax), total:Number(r.total), status:r.status, pdfUrl:r.pdf_url||undefined, createdAt:new Date(r.created_at).getTime(), updatedAt:new Date(r.updated_at).getTime() }))
  }
  return memInvoices.filter(i => i.orgId === orgId)
}

export async function getInvoiceById(id: string) {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (sb) {
    const { data: inv } = await sb.from('billing_invoices').select('*').eq('id', id).single()
    if (!inv) return undefined
    const { data: rows } = await sb.from('billing_line_items').select('*').eq('invoice_id', id)
    return {
      invoice: { id:inv.id, orgId:inv.org_id, invoiceNumber:inv.invoice_number, invoiceDate:inv.invoice_date, billingPeriodStart:inv.billing_period_start, billingPeriodEnd:inv.billing_period_end, subtotal:Number(inv.subtotal), tax:Number(inv.tax), total:Number(inv.total), status:inv.status, pdfUrl:inv.pdf_url||undefined, createdAt:new Date(inv.created_at).getTime(), updatedAt:new Date(inv.updated_at).getTime() },
      lineItems: (rows||[]).map((r:any)=> ({ id:r.id, invoiceId:r.invoice_id, title:r.title, description:r.description||undefined, quantity:Number(r.quantity), unitPrice:Number(r.unit_price), total:Number(r.total) }))
    }
  }
  const invoice = memInvoices.find(i => i.id === id)
  if (!invoice) return undefined
  const lineItems = memLines.filter(l => l.invoiceId === id)
  return { invoice, lineItems }
}

export async function markPaid(id: string) {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  const now = new Date()
  if (sb) {
    const { data, error } = await sb.from('billing_invoices').update({ status: 'paid', updated_at: now }).eq('id', id).select('*').single()
    if (error) return 'DB_ERROR'
    return { ok: true }
  }
  const inv = memInvoices.find(i => i.id === id)
  if (!inv) return 'NOT_FOUND'
  inv.status = 'paid'
  inv.updatedAt = now.getTime()
  return { ok: true }
}

export async function saveBillingSettings(input: { orgId: string, billingEmail: string, paymentMethodType?: string, paymentMethodToken?: string }) {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  const now = new Date()
  if (sb) {
    const { data: existing } = await sb.from('billing_settings').select('*').eq('org_id', input.orgId).limit(1).maybeSingle()
    if (existing) {
      const { error } = await sb.from('billing_settings').update({ billing_email: input.billingEmail, payment_method_type: input.paymentMethodType ?? null, payment_method_token: input.paymentMethodToken ?? null }).eq('id', existing.id)
      if (error) return 'DB_ERROR'
    } else {
      const { error } = await sb.from('billing_settings').insert({ org_id: input.orgId, billing_email: input.billingEmail, payment_method_type: input.paymentMethodType ?? null, payment_method_token: input.paymentMethodToken ?? null, created_at: now })
      if (error) return 'DB_ERROR'
    }
    return { ok: true }
  }
  return { ok: true }
}

