import { NextRequest, NextResponse } from 'next/server'
import { createShift, listShifts, listTeamMemberIds } from '@lib/db'

function allowRole(req: NextRequest, action: 'create'|'list') {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const allowed = ['owner','admin','manager']
  if (action === 'list') return true
  return allowed.includes(role)
}

export async function POST(req: NextRequest) {
  if (!allowRole(req, 'create')) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json()
  const orgId = body.org_id || body.orgId
  const name = body.name
  const startTime = body.start_time || body.startTime
  const endTime = body.end_time || body.endTime
  const isOvernight = !!(body.is_overnight ?? body.isOvernight)
  const graceMinutes = Number(body.grace_minutes ?? body.graceMinutes ?? 0)
  const breakMinutes = Number(body.break_minutes ?? body.breakMinutes ?? 0)
  if (!orgId || !name || !startTime || !endTime) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const r = await createShift({ orgId, name, startTime, endTime, isOvernight, graceMinutes, breakMinutes })
  const codes: Record<string, number> = { DB_ERROR: 500 }
  if (typeof r === 'string') return NextResponse.json({ error: r }, { status: codes[r] || 400 })
  return NextResponse.json({ shift: r })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') || searchParams.get('orgId') || ''
  if (!orgId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const items = await listShifts(orgId)
  return NextResponse.json({ items })
}

