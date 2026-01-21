import { NextRequest, NextResponse } from 'next/server'
import { submitTimesheet } from '@lib/timesheets'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { timesheetId } = body
    const userId = req.headers.get('x-user-id')

    if (!timesheetId || !userId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const result = await submitTimesheet(timesheetId, userId)
    
    // TODO: Notify admin (placeholder)
    
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Submit timesheet error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
