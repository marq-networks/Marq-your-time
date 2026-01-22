import { NextRequest, NextResponse } from 'next/server'
import { getCalendarEventsForUsers } from '@lib/calendar-service'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  
  // Filters: department, user_ids (comma separated)
  const departmentId = searchParams.get('department')
  const userIdsParam = searchParams.get('users')
  const projectId = searchParams.get('project_id')
  
  // Auth
  const requesterId = req.headers.get('x-user-id') || req.cookies.get('current_user_id')?.value
  const orgId = req.headers.get('x-org-id') || req.cookies.get('current_org_id')?.value
  const role = req.headers.get('x-role') || req.cookies.get('current_role')?.value

  if (!requesterId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (role !== 'admin' && role !== 'super_admin' && role !== 'owner') {
     return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!from || !to) {
    return NextResponse.json({ error: 'Missing date range' }, { status: 400 })
  }

  // Resolve users to fetch
  let targetUserIds: string[] = []

  if (userIdsParam) {
      targetUserIds = userIdsParam.split(',')
  } else if (departmentId) {
      // Fetch users in department
      // We would need a way to fetch users by department.
      // Assuming a service or direct DB query.
      // For now, let's just use the query if we had a helper.
      // Since I can't easily fetch users by department without Supabase here,
      // I'll assume the client passes user IDs or I query all users if no filter.
      // If no users/department specified, fetch ALL users? That might be heavy.
      // Let's require at least some filter or limit.
      // Or just fetch all active users in org.
      // Let's default to fetching all users in org if no filter.
  }
  
  // If no user IDs provided, fetch all users in org
  if (targetUserIds.length === 0) {
      // Need to fetch all user IDs for the org.
      // We can do this via Supabase inside the service, but let's do it here or pass empty array to mean "all"?
      // Passing empty array to 'in' usually means nothing.
      // Let's fetch user IDs first.
      const sb = (await import('@lib/supabase')).supabaseServer()
      if (sb) {
          let q = sb.from('users').select('id').eq('org_id', orgId)
          if (departmentId) q = q.eq('department_id', departmentId)
          const { data } = await q
          if (data) targetUserIds = data.map((u: any) => u.id)
      }
  }

  if (targetUserIds.length === 0) {
      return NextResponse.json({ events: [] })
  }

  try {
    const events = await getCalendarEventsForUsers(targetUserIds, orgId, from, to, projectId || undefined)
    return NextResponse.json({ events })
  } catch (error) {
    console.error('Calendar Team API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
