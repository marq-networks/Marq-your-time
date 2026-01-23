
import { NextResponse } from 'next/server'
import { supabaseServer } from '@lib/supabase'
import { encrypt } from '@lib/encryption'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 })
  }

  const parts = state.split(':')
  if (parts.length < 2) {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
  }
  const orgId = parts[1]

  const sb = supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env.SLACK_CLIENT_ID
  const clientSecret = process.env.SLACK_CLIENT_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/integrations/slack/callback`

  const formData = new URLSearchParams()
  formData.append('client_id', clientId!)
  formData.append('client_secret', clientSecret!)
  formData.append('code', code)
  formData.append('redirect_uri', redirectUri)

  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    body: formData,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
  
  const data = await res.json()

  if (!data.ok) {
    return NextResponse.json({ error: data.error }, { status: 400 })
  }

  const { access_token, team, bot_user_id } = data
  const encryptedToken = encrypt(access_token)

  const { error: dbError } = await sb
    .from('integrations_slack')
    .upsert({
      org_id: orgId,
      slack_team_id: team.id,
      slack_team_name: team.name,
      slack_bot_user_id: bot_user_id,
      access_token_encrypted: encryptedToken,
      connected_by: user.id,
      is_enabled: true,
      connected_at: new Date().toISOString()
    }, { onConflict: 'org_id' })

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  const { data: existingSettings } = await sb
    .from('integrations_slack_settings')
    .select('id')
    .eq('org_id', orgId)
    .single()

  if (!existingSettings) {
    await sb.from('integrations_slack_settings').insert({
      org_id: orgId,
      default_channel_id: '',
      default_channel_name: '',
      notify_events: {
        timesheet_submitted: true,
        timesheet_approved: true,
        timesheet_rejected: true,
        timesheet_changes_required: true,
        smart_alerts: true,
        missing_screenshots: true,
        break_abuse: true,
        absent_login: true,
        payroll_generated: false
      }
    })
  }

  return NextResponse.redirect(`${appUrl}/settings/integrations/slack?connected=true`)
}
