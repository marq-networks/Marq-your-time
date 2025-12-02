import { NextRequest, NextResponse } from 'next/server'
import { lockPayrollPeriod } from '@lib/db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  if (!id) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await lockPayrollPeriod(id)
  const codes: Record<string, number> = { DB_ERROR: 500 }
  if (!res || typeof res === 'string') return NextResponse.json({ error: res || 'NOT_FOUND' }, { status: res ? codes[res] || 400 : 404 })
  return NextResponse.json({ period: res })
}

