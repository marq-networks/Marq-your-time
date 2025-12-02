import { NextRequest, NextResponse } from 'next/server'
import { listPeriods } from '@lib/payroll/store'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const org_id = searchParams.get('org_id') || ''
  const limit = Number(searchParams.get('limit') || '50')
  const cursor = searchParams.get('cursor') || undefined
  if (!org_id) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await listPeriods(org_id, Math.max(1, Math.min(200, limit)), cursor || undefined)
  return NextResponse.json(res)
}

