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
  const actor_user_id = req.headers.get('x-user-id')
  const actor_role = (req.headers.get('x-role') || '').toLowerCase()

  // 1. Validation
  if (!actor_user_id || !org_id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  // Check role
  const allowedRoles = ['admin', 'super_admin', 'owner']
  if (!allowedRoles.includes(actor_role)) {
    return NextResponse.json({ error: 'FORBIDDEN_ROLE' }, { status: 403 })
  }

  // Check required fields
  if (!employee_user_id || !module || !entity_table || !field_name || !reason) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  }

  // Check reason length
  if (reason.length < 8) {
    return NextResponse.json({ error: 'REASON_TOO_SHORT' }, { status: 400 })
  }

  // Check if actor belongs to org (Double check)
  const { data: membership } = await sb
    .from('org_users')
    .select('role')
    .eq('org_id', org_id)
    .eq('user_id', actor_user_id)
    .single()

  if (!membership || !allowedRoles.includes(membership.role)) {
    return NextResponse.json({ error: 'FORBIDDEN_ORG_ACCESS' }, { status: 403 })
  }

  // 2. Insert Log
  const { error } = await createHRLog({
    org_id,
    actor_user_id,
    actor_role: membership.role,
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
