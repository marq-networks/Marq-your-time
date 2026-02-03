
import { NextResponse } from 'next/server'
import { supabaseServer } from '@lib/supabase'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { orgId } = body

  if (!orgId) return NextResponse.json({ error: 'Missing orgId' }, { status: 400 })

  const sb = supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check permissions
  const { data: role } = await sb
    .from('users')
    .select('role_id, roles(name, permissions)')
    .eq('id', user.id)
    .eq('org_id', orgId)
    .single()

  const roleAny = role as any
  const roleName = roleAny?.roles?.name || (Array.isArray(roleAny?.roles) ? roleAny.roles[0]?.name : undefined)
  const perms = roleAny?.roles?.permissions || (Array.isArray(roleAny?.roles) ? roleAny.roles[0]?.permissions : undefined)
  const isAdmin = ['Admin', 'Owner', 'Super Admin'].includes(roleName) || (perms && perms.manage_org)

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Soft delete / Disconnect
  const { error } = await sb
    .from('integrations_slack')
    .update({
      is_enabled: false,
      access_token_encrypted: '',
      slack_team_id: '',
      slack_bot_user_id: '',
      connected_by: user.id,
      connected_at: null
    })
    .eq('org_id', orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
