import { NextRequest, NextResponse } from 'next/server'
import { generateLandingLink } from '@lib/db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const host = req.headers.get('host') || 'localhost:3000'
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const base = `${proto}://${host}`
  const res = await generateLandingLink(params.id, body.priceOverride, body.prefillEmail, base)
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 400 })
  return NextResponse.json(res)
}
