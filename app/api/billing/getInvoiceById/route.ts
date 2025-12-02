import { NextRequest, NextResponse } from 'next/server'
import { getInvoiceById } from '@lib/billing'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id') || ''
  if (!id) return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })
  const res = await getInvoiceById(id)
  if (!res) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json(res)
}

