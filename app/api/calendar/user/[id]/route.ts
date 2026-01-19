import { NextRequest, NextResponse } from 'next/server'
import { getCalendarEvents } from '@lib/calendar-service'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const targetUserId = params.id
  
  // Auth check: Requester must be admin or the user themselves
  const requesterId = req.headers.get('x-user-id') || req.cookies.get('current_user_id')?.value
  const orgId = req.headers.get('x-org-id') || req.cookies.get('current_org_id')?.value
  const role = req.headers.get('x-role') || req.cookies.get('current_role')?.value

  if (!requesterId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Access control
  if (requesterId !== targetUserId && role !== 'admin' && role !== 'super_admin' && role !== 'owner') {
     return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!from || !to) {
    return NextResponse.json({ error: 'Missing date range' }, { status: 400 })
  }

  try {
    const events = await getCalendarEvents(targetUserId, orgId, from, to)
    return NextResponse.json({ events })
  } catch (error) {
    console.error('Calendar API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
