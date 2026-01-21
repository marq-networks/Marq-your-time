import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listAllOrgMembers } from '@lib/db'

export async function GET(req: NextRequest) {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'DB_NOT_CONFIGURED' }, { status: 500 })

  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('orgId') || searchParams.get('org_id')
  const employeeUserId = searchParams.get('employeeUserId') || searchParams.get('employee_user_id')
  const module = searchParams.get('module')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const limit = parseInt(searchParams.get('limit') || '50')
  const page = parseInt(searchParams.get('page') || '1')
  const offset = (page - 1) * limit

  const actorId = req.headers.get('x-user-id') || req.cookies.get('current_user_id')?.value
  const actorRole = (req.headers.get('x-role') || req.cookies.get('current_role')?.value || '').toLowerCase()

  if (!actorId) {
    console.log('[HR_LOG_LIST] UNAUTHORIZED: Missing actorId')
    console.log('Headers:', Object.fromEntries(req.headers))
    console.log('Cookies:', req.cookies.getAll())
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  if (!orgId) {
    return NextResponse.json({ error: 'MISSING_ORG_ID' }, { status: 400 })
  }

  // 1. Permission Check
  // Check if actor is in the org and get their role
  const { data: userRow } = await sb.from('users').select('*, role:roles(name)').eq('id', actorId).eq('org_id', orgId).maybeSingle()
  const { data: memberRow } = await sb.from('org_memberships').select('role').eq('user_id', actorId).eq('org_id', orgId).maybeSingle()

  const effectiveRole = (userRow?.role?.name || memberRow?.role || '').toLowerCase()
  
  if (!effectiveRole) {
    return NextResponse.json({ error: 'FORBIDDEN_ORG_ACCESS' }, { status: 403 })
  }

  const isAdmin = ['admin', 'super_admin', 'owner'].includes(effectiveRole)

  // If not admin, ensure they are only requesting their own logs
  // OR force the filter to their own ID
  let targetEmployeeId = employeeUserId
  if (!isAdmin) {
    // If employee asks for someone else's logs, deny or override?
    // Requirements: "employee can read their own logs only"
    if (targetEmployeeId && targetEmployeeId !== actorId) {
      return NextResponse.json({ error: 'FORBIDDEN_ACCESS_OTHER_USER' }, { status: 403 })
    }
    targetEmployeeId = actorId
  }

  // 2. Query
  let query = sb
    .from('hr_adjustments_log')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (targetEmployeeId) {
    query = query.eq('employee_user_id', targetEmployeeId)
  }

  if (module) {
    query = query.eq('module', module)
  }

  if (from) {
    query = query.gte('created_at', from) // Assuming ISO string or YYYY-MM-DD
  }

  if (to) {
    let toDate = to
    if (to.length === 10) {
      toDate = `${to}T23:59:59`
    }
    query = query.lte('created_at', toDate)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching HR logs:', error)
    return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 })
  }

  // 3. Enrich with user names
  const members = await listAllOrgMembers(orgId)
  const memberMap = new Map(members.map(m => [m.id, { firstName: m.firstName, lastName: m.lastName, email: m.email }]))

  const items = (data || []).map(log => ({
    ...log,
    actor: memberMap.get(log.actor_user_id) || { firstName: 'Unknown', lastName: '', email: '' },
    employee: memberMap.get(log.employee_user_id) || { firstName: 'Unknown', lastName: '', email: '' }
  }))
  
  return NextResponse.json({ items, total: count, page, limit })
}
