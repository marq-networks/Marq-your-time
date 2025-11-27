import { NextRequest, NextResponse } from 'next/server'
import { createOrganization } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const required = ['orgName','ownerName','ownerEmail','billingEmail','pricePerLogin','totalLicensedSeats','subscriptionType']
  for (const k of required) if (body[k] === undefined || body[k] === '') return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const org = await createOrganization(body)
  return NextResponse.json({ org })
}
