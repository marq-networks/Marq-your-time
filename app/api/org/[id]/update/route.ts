import { NextRequest, NextResponse } from 'next/server'
import { updateOrganization } from '@lib/db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const patch = await req.json()
  const res = await updateOrganization(params.id, patch)
  if (res === 'SEAT_LIMIT_BELOW_USED') return NextResponse.json({ error: res }, { status: 400 })
  if (!res) return NextResponse.json({ error: 'ORG_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ org: res })
}
