import { NextRequest, NextResponse } from 'next/server'
import { deleteDepartment } from '@lib/db'

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const res = await deleteDepartment(params.id)
  if (res === 'DEPARTMENT_NOT_FOUND') return NextResponse.json({ error: res }, { status: 404 })
  if (res === 'DEPT_HAS_USERS') return NextResponse.json({ error: res }, { status: 400 })
  if (res !== 'OK') return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

