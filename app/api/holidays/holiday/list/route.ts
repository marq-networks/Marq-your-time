import { NextRequest, NextResponse } from 'next/server'
import { listHolidays, getActiveHolidayCalendar } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const calendar_id = searchParams.get('calendar_id') || searchParams.get('calendarId') || ''
  const year = Number(searchParams.get('year') || new Date().getFullYear())
  let calId = calendar_id
  const org_id = searchParams.get('org_id') || searchParams.get('orgId') || undefined
  if (!calId && org_id) calId = (await getActiveHolidayCalendar(org_id)) || ''
  if (!calId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const items = await listHolidays(calId)
  const filtered = items.filter(h => String(h.date).slice(0,4) === String(year))
  return NextResponse.json({ items: filtered })
}

