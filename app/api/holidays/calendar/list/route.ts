import { NextRequest, NextResponse } from 'next/server'
import { listHolidayCalendars, setActiveHolidayCalendar, getActiveHolidayCalendar } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const org_id = searchParams.get('org_id') || searchParams.get('orgId') || ''
  if (!org_id) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const calendars = await listHolidayCalendars(org_id)
  const active_id = await getActiveHolidayCalendar(org_id)
  return NextResponse.json({ items: calendars, active_calendar_id: active_id || null })
}

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!['admin','owner','super_admin'].includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json().catch(()=>({}))
  const org_id = body.org_id || body.orgId
  const calendar_id = body.calendar_id || body.calendarId
  if (!org_id || !calendar_id) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const ok = await setActiveHolidayCalendar(org_id, calendar_id)
  if (ok !== 'OK') return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ status: 'OK' })
}

