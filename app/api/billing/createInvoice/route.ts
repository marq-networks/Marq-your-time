import { NextRequest, NextResponse } from 'next/server'
import { createInvoice } from '@lib/billing'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const orgId = body.orgId || ''
  const invoiceDate = body.invoiceDate || ''
  const periodStart = body.billingPeriodStart || body.periodStart || ''
  const periodEnd = body.billingPeriodEnd || body.periodEnd || ''
  const basePrice = Number(body.basePrice ?? 0)
  const perLoginCost = Number(body.perLoginCost ?? 0)
  const manualItems = Array.isArray(body.items) ? body.items.map((it: any) => ({ title: it.title, description: it.description, quantity: Number(it.quantity || 0), unitPrice: Number(it.unitPrice || 0) })) : []
  if (!orgId || !invoiceDate || !periodStart || !periodEnd) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await createInvoice({ orgId, invoiceDate, periodStart, periodEnd, basePrice, perLoginCost, manualItems })
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 400 })
  return NextResponse.json(res)
}

