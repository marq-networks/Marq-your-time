import { NextRequest, NextResponse } from 'next/server'
import { processPrivacyRequest } from '@lib/db'

function allow(role: string) { return ['admin','owner','super_admin'].includes(role.toLowerCase()) }

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>({}))
  const id = body.id || body.request_id || body.requestId
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const actor = req.headers.get('x-user-id') || ''
  if (!id) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  if (!allow(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const res = await processPrivacyRequest(id, actor)
  if (res === 'NOT_FOUND') return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (res === 'FORBIDDEN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  if (res === 'DB_ERROR') return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ request: res })
}
