import { NextRequest, NextResponse } from 'next/server'
import { deleteRole } from '@lib/db'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const res = await deleteRole(params.id)
  if (res === 'ROLE_NOT_FOUND') return NextResponse.json({ error: res }, { status: 404 })
  if (res !== 'OK') return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

