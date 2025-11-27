import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@lib/db'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser(params.id)
  if (!user) return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ user })
}

