import { NextRequest, NextResponse } from 'next/server'
import { markPaid } from '@lib/billing'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const id = body.id || ''
  if (!id) return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })
  const res = await markPaid(id)
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 400 })
  return NextResponse.json(res)
}

