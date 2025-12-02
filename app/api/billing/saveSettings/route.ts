import { NextRequest, NextResponse } from 'next/server'
import { saveBillingSettings } from '@lib/billing'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const orgId = body.orgId || ''
  const billingEmail = body.billingEmail || ''
  const paymentMethodType = body.paymentMethodType || undefined
  const paymentMethodToken = body.paymentMethodToken || undefined
  if (!orgId || !billingEmail) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await saveBillingSettings({ orgId, billingEmail, paymentMethodType, paymentMethodToken })
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 400 })
  return NextResponse.json(res)
}

