import { NextRequest, NextResponse } from 'next/server'
import { updateRole } from '@lib/db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const res = await updateRole(params.id, { name: body.name, permissions: body.permissions })
  if (res === 'INVALID_PERMISSION' || res === 'RESERVED_ROLE_NAME') return NextResponse.json({ error: res }, { status: 400 })
  if (res === 'DB_ERROR') return NextResponse.json({ error: res }, { status: 500 })
  if (!res) return NextResponse.json({ error: 'ROLE_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ role: res })
}

