import { NextRequest, NextResponse } from 'next/server'
import { generateLandingLink } from '@lib/db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const res = await generateLandingLink(params.id, body.priceOverride, body.prefillEmail)
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 400 })
  return NextResponse.json(res)
}
