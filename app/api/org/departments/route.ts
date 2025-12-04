import { NextRequest, NextResponse } from 'next/server'
import { createDepartment } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>({}))
  const org_id = body.org_id || body.orgId
  const name = body.name
  const description = body.description ?? undefined
  const parent_id = body.parent_id ?? body.parentId ?? undefined
  if (!org_id || !name) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await createDepartment({ orgId: org_id, name, description, parentId: parent_id })
  if (typeof res === 'string') {
    const codes: Record<string, number> = { ORG_NOT_FOUND: 404, DB_FORBIDDEN: 403, DEPARTMENT_DUPLICATE: 409, DB_ERROR: 500 }
    return NextResponse.json({ error: res }, { status: codes[res] || 400 })
  }
  return NextResponse.json({ department: res })
}

