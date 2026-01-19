import { NextRequest, NextResponse } from 'next/server'
import { reviewBreakApproval } from '@lib/db'

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const allowedRoles = ['super_admin', 'org_admin', 'admin', 'owner', 'hr', 'manager']
  if (!allowedRoles.includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const id = body.approval_id || body.id
  const status = body.status
  const note = body.note || ''
  if (!id || !status || !['approved', 'rejected'].includes(status)) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const reviewerId = req.headers.get('x-user-id') || undefined
  const res = await reviewBreakApproval({ id, status, note, reviewerId, actorRole: role } as any)
  if (res === 'NOT_FOUND') return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (res === 'DB_ERROR') return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ item: res })
}

