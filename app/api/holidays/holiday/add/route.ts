import { NextRequest, NextResponse } from 'next/server'
import { addHoliday } from '@lib/db'

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!['admin','owner','super_admin'].includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json().catch(()=>({}))
  const calendar_id = body.calendar_id || body.calendarId
  const date = body.date
  const name = body.name
  const is_full_day = body.is_full_day
  if (!calendar_id || !date || !name) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await addHoliday({ calendarId: calendar_id, date, name, isFullDay: !!is_full_day })
  if (res === 'DB_ERROR') return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ holiday: res })
}

