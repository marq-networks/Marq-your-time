import { NextResponse } from 'next/server'
import { rejectInvite } from '@lib/db'

export async function POST(_: Request, { params }: { params: { token: string } }) {
  const res = await rejectInvite(params.token)
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 400 })
  return NextResponse.json(res)
}
