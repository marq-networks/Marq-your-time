import { NextRequest, NextResponse } from 'next/server'
import { createOrGetTimesheet, TimesheetPeriod } from '@lib/timesheets'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orgId, employeeUserId, periodType, periodStart, periodEnd } = body

    if (!orgId || !employeeUserId || !periodStart || !periodEnd) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const timesheet = await createOrGetTimesheet(
      orgId,
      employeeUserId,
      periodType as TimesheetPeriod,
      periodStart,
      periodEnd
    )

    return NextResponse.json(timesheet)
  } catch (error: any) {
    console.error('Create timesheet error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
