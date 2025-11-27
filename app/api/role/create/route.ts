import { NextRequest, NextResponse } from 'next/server'
import { createRole } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const required = ['orgId','name','permissions']
  for (const k of required) if (body[k] === undefined || body[k] === '' || (k==='permissions' && !Array.isArray(body[k]))) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await createRole({ orgId: body.orgId, name: body.name, permissions: body.permissions })
  if (typeof res === 'string') {
    const code = res === 'ORG_NOT_FOUND' ? 404 : res === 'INVALID_PERMISSION' ? 400 : 500
    return NextResponse.json({ error: res }, { status: code })
  }
  return NextResponse.json({ role: res })
}

