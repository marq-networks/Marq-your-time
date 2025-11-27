import { NextRequest, NextResponse } from 'next/server'
import { suspendUser } from '@lib/db'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const res = await suspendUser(params.id)
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 404 })
  return NextResponse.json({ user: res })
}

