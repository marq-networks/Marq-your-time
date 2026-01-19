import { NextRequest, NextResponse } from 'next/server'
import { getCalendarEvents } from '@lib/calendar-service'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  
  // Get user context from headers or cookies (simulated here as we rely on middleware or client passing it)
  // In this project, it seems we often pass x-user-id or extract from cookie.
  // Let's try to get from cookie or header.
  
  const userId = req.headers.get('x-user-id') || 
                 req.cookies.get('current_user_id')?.value
                 
  const orgId = req.headers.get('x-org-id') || 
                req.cookies.get('current_org_id')?.value

  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!from || !to) {
    return NextResponse.json({ error: 'Missing date range' }, { status: 400 })
  }

  try {
    const events = await getCalendarEvents(userId, orgId, from, to)
    return NextResponse.json({ events })
  } catch (error) {
    console.error('Calendar API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
