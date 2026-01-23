
import { NextResponse } from 'next/server'
import { supabaseServer } from '@lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const orgId = searchParams.get('orgId')
  if (!orgId) return NextResponse.json({ error: 'Missing orgId' }, { status: 400 })

  const sb = supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Integration status
  const { data: integration } = await sb
    .from('integrations_slack')
    .select('id, slack_team_name, is_enabled, connected_at')
    .eq('org_id', orgId)
    .single()

  // Settings
  const { data: settings } = await sb
    .from('integrations_slack_settings')
    .select('*')
    .eq('org_id', orgId)
    .single()

  return NextResponse.json({ 
    integration: integration || null, 
    settings: settings || null 
  })
}

export async function POST(request: Request) {
  const body = await request.json()
  const { orgId, default_channel_id, default_channel_name, notify_events, mention_user_ids, is_enabled } = body

  if (!orgId) return NextResponse.json({ error: 'Missing orgId' }, { status: 400 })

  const sb = supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check Admin
  const { data: role } = await sb
    .from('users')
    .select('role_id, roles(name, permissions)')
    .eq('id', user.id)
    .eq('org_id', orgId)
    .single()

  const roleName = role?.roles?.name
  const perms = role?.roles?.permissions
  const isAdmin = ['Admin', 'Owner', 'Super Admin'].includes(roleName) || (perms && perms.manage_org)

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Update Settings
  const { error: settingsError } = await sb
    .from('integrations_slack_settings')
    .upsert({
      org_id: orgId,
      default_channel_id,
      default_channel_name,
      notify_events,
      mention_user_ids,
      updated_at: new Date().toISOString()
    }, { onConflict: 'org_id' })

  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 })

  // Update Integration Enabled Status
  if (typeof is_enabled === 'boolean') {
    await sb.from('integrations_slack').update({ is_enabled }).eq('org_id', orgId)
  }

  return NextResponse.json({ success: true })
}
