
import { NextResponse } from 'next/server'
import { supabaseServer } from '@lib/supabase'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const orgId = searchParams.get('orgId')

  if (!orgId) {
    return NextResponse.json({ error: 'Missing orgId' }, { status: 400 })
  }

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

  const roleName = role?.roles?.name
  const perms = role?.roles?.permissions
  const isAdmin = ['Admin', 'Owner', 'Super Admin'].includes(roleName) || (perms && perms.manage_org)

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const state = crypto.randomBytes(16).toString('hex') + ':' + orgId
  const clientId = process.env.SLACK_CLIENT_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/integrations/slack/callback`
  const scopes = 'chat:write,channels:read,groups:read,im:read,mpim:read'

  const url = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`

  return NextResponse.redirect(url)
}
