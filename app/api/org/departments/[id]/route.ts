import { NextRequest, NextResponse } from 'next/server'
import { updateDepartment, deleteDepartment } from '@lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(()=>({}))
  const name = body.name
  const description = body.description
  const parent_id = body.parent_id ?? body.parentId
  if (name === undefined && description === undefined && parent_id === undefined) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await updateDepartment(params.id, { name, description, parentId: parent_id })
  if (res === 'DB_ERROR') return NextResponse.json({ error: res }, { status: 500 })
  if (!res) return NextResponse.json({ error: 'DEPARTMENT_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ department: res })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const r = await deleteDepartment(params.id)
  const codes: Record<string, number> = { DEPARTMENT_NOT_FOUND: 404, DEPT_HAS_USERS: 400, DB_ERROR: 500 }
  if (r !== 'OK') return NextResponse.json({ error: r }, { status: codes[r] || 400 })
  return NextResponse.json({ ok: true })
}

