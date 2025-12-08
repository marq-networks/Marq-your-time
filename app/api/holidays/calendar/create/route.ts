import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@lib/supabase'
import { createHolidayCalendar } from '@lib/db'

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!['admin','owner','super_admin'].includes(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json().catch(()=>({}))
  const org_id = body.org_id || body.orgId
  const name = body.name
  const country_code = body.country_code || body.countryCode
  if (!org_id || !name) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await createHolidayCalendar({ orgId: org_id, name, countryCode: country_code })
  if (res === 'DB_ERROR') return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ calendar: res })
}

