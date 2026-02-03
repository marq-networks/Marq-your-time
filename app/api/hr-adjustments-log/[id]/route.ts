import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { listAllOrgMembers } from '@lib/db'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'DB_NOT_CONFIGURED' }, { status: 500 })

  const id = params.id
  if (!id) return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })

  const actorId = req.headers.get('x-user-id') || req.cookies.get('current_user_id')?.value
  
  if (!actorId) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  // Fetch the log item
  const { data: log, error } = await sb
    .from('hr_adjustments_log')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !log) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  // Permission check
  // User must be admin OR the employee/actor of the log
  const orgId = log.org_id
  
  // Check user role in this org
  const { data: userRow } = await sb.from('users').select('*, role:roles(name)').eq('id', actorId).eq('org_id', orgId).maybeSingle()
  const { data: memberRow } = await sb.from('org_memberships').select('role').eq('user_id', actorId).eq('org_id', orgId).maybeSingle()
  const effectiveRole = (userRow?.role?.name || memberRow?.role || '').toLowerCase()

  const isAdmin = ['admin', 'super_admin', 'owner'].includes(effectiveRole)
  
  if (!isAdmin && log.employee_user_id !== actorId && log.actor_user_id !== actorId) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  // Enrich with names
  // We only need names for this specific log, but listAllOrgMembers is cached usually or we can just fetch these two users
  // Using listAllOrgMembers for consistency if it's cheap, but maybe fetching specific users is better for performance?
  // listAllOrgMembers fetches all profiles. For single item view, it's fine.
  const members = await listAllOrgMembers(orgId)
  const memberMap = new Map(members.map(m => [m.id, { firstName: m.firstName, lastName: m.lastName, email: m.email }]))

  const enrichedLog = {
      ...log,
      actor: memberMap.get(log.actor_user_id) || { firstName: 'Unknown', lastName: '', email: '' },
      employee: memberMap.get(log.employee_user_id) || { firstName: 'Unknown', lastName: '', email: '' }
  }

  return NextResponse.json(enrichedLog)
}
