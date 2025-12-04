import { NextRequest, NextResponse } from 'next/server'
import { updateMemberRole, deleteMemberRole } from '@lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(()=>({}))
  const name = body.name
  const level = body.level !== undefined ? Number(body.level) : undefined
  if (name === undefined && level === undefined) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await updateMemberRole(params.id, { name, level })
  if (res === 'DB_ERROR') return NextResponse.json({ error: res }, { status: 500 })
  if (!res) return NextResponse.json({ error: 'ROLE_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ role: res })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const r = await deleteMemberRole(params.id)
  const codes: Record<string, number> = { ROLE_NOT_FOUND: 404, ROLE_IN_USE: 400, DB_ERROR: 500 }
  if (r !== 'OK') return NextResponse.json({ error: r }, { status: codes[r] || 400 })
  return NextResponse.json({ ok: true })
}

