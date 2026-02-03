import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { createHRLog } from '@lib/hr-log'

export async function POST(req: NextRequest) {
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  if (!sb) return NextResponse.json({ error: 'DB_NOT_CONFIGURED' }, { status: 500 })

  const body = await req.json().catch(() => ({}))
  const {
    org_id,
    employee_user_id,
    module,
    entity_table,
    entity_id,
    field_name,
    old_value,
    new_value,
    reason,
    attachment_path
  } = body

  // Headers for actor context
  let actor_user_id = req.headers.get('x-user-id') || req.cookies.get('current_user_id')?.value
  const actor_role = (req.headers.get('x-role') || req.cookies.get('current_role')?.value || '').toLowerCase()
  const isOrgLogin = req.cookies.get('org_login')?.value === 'true'

  // 1. Validation
  if (!actor_user_id && !isOrgLogin) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  if (!org_id) {
    return NextResponse.json({ error: 'MISSING_ORG_ID' }, { status: 400 })
  }

  let effectiveRole = ''
  
  if (isOrgLogin) {
    // If Org Login, we act as Admin. 
    // We need an actor_user_id for the log (FK constraint likely).
    // Fetch the Owner or first Admin of the org to use as the actor.
    const { data: ownerMem } = await sb.from('org_memberships')
      .select('user_id')
      .eq('org_id', org_id)
      .in('role', ['owner', 'admin'])
      .limit(1)
      .maybeSingle()
    
    if (ownerMem) {
      actor_user_id = ownerMem.user_id
      effectiveRole = 'admin'
    } else {
      // If no admin found, we can't create a log safely if FK is enforced
      return NextResponse.json({ error: 'NO_ADMIN_USER_FOUND_FOR_ORG' }, { status: 500 })
    }
  } else {
    // Check role
    const allowedRoles = ['admin', 'super_admin', 'owner', 'manager']
    if (!allowedRoles.includes(actor_role)) {
      return NextResponse.json({ error: 'FORBIDDEN_ROLE', details: `Role ${actor_role} not allowed` }, { status: 403 })
    }
    
    // Check if actor belongs to org (Double check)
    const { data: userRow } = await sb.from('users').select('*, role:roles(name)').eq('id', actor_user_id).eq('org_id', org_id).maybeSingle()
    const { data: memberRow } = await sb.from('org_memberships').select('role').eq('user_id', actor_user_id).eq('org_id', org_id).maybeSingle()

    effectiveRole = (userRow?.role?.name || memberRow?.role || '').toLowerCase()

    if (!effectiveRole || !allowedRoles.includes(effectiveRole)) {
      return NextResponse.json({ error: 'FORBIDDEN_ORG_ACCESS' }, { status: 403 })
    }
  }

  // 2. Insert Log
  const { error } = await createHRLog({
    org_id,
    actor_user_id,
    actor_role: effectiveRole,
    employee_user_id,
    module,
    entity_table,
    entity_id,
    field_name,
    old_value,
    new_value,
    reason,
    attachment_path,
    metadata: {
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown'
    }
  })

  if (error) {
    return NextResponse.json({ error: 'DB_ERROR', details: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
