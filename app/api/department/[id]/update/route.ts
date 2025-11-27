import { NextRequest, NextResponse } from 'next/server'
import { updateDepartment } from '@lib/db'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  if (!body.name || body.name === '') return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await updateDepartment(params.id, { name: body.name })
  if (res === 'DB_ERROR') return NextResponse.json({ error: res }, { status: 500 })
  if (!res) return NextResponse.json({ error: 'DEPARTMENT_NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ department: res })
}

