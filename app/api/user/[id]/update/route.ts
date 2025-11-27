import { NextRequest, NextResponse } from 'next/server'
import { updateUser } from '@lib/db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const patch = await req.json()
  const res = await updateUser(params.id, patch)
  if (res === 'DB_ERROR') return NextResponse.json({ error: res }, { status: 500 })
  if (res === 'ROLE_NOT_FOUND' || res === 'DEPARTMENT_NOT_FOUND' || res === 'ORG_MISMATCH_ROLE' || res === 'ORG_MISMATCH_DEPARTMENT') return NextResponse.json({ error: res }, { status: 400 })
  if (!res) return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ user: res })
}
