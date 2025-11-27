import { NextRequest, NextResponse } from 'next/server'
import { acceptInvite } from '@lib/db'

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const body = await req.json()
  const res = await acceptInvite(params.token, !!body.grantPermissions)
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 400 })
  return NextResponse.json(res)
}
