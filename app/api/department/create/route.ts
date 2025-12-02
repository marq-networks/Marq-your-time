import { NextRequest, NextResponse } from 'next/server'
import { createDepartment, listDepartments } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const required = ['orgId','name']
  for (const k of required) if (!body[k] || body[k] === '') return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await createDepartment({ orgId: body.orgId, name: body.name })
  if (typeof res === 'string') {
    if (res.startsWith('DB_ERROR_')) {
      const items = await listDepartments(body.orgId)
      const found = items.find(x => x.name === body.name)
      if (found) return NextResponse.json({ department: found })
      if (res === 'DB_ERROR_PGRST205') {
        return NextResponse.json({ created: true })
      }
    }
    const code =
      res === 'MISSING_FIELDS' ? 400 :
      res === 'INVALID_ORG_ID' ? 400 :
      res === 'ORG_NOT_FOUND' ? 404 :
      res === 'DEPARTMENT_DUPLICATE' ? 409 :
      res === 'DB_FORBIDDEN' ? 403 :
      res === 'DB_TABLE_MISSING' ? 500 : 500
    return NextResponse.json({ error: res }, { status: code })
  }
  return NextResponse.json({ department: res })
}
