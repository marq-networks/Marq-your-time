import { NextRequest, NextResponse } from 'next/server'
import { exportPayrollPeriod } from '@lib/db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  if (!id) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await exportPayrollPeriod(id)
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 400 })
  return NextResponse.json(res)
}

