
import { NextResponse } from 'next/server'
import { supabaseServer } from '@lib/supabase'
import { decrypt } from '@lib/encryption'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const orgId = searchParams.get('orgId')

  if (!orgId) return NextResponse.json({ error: 'Missing orgId' }, { status: 400 })

  const sb = supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch integration
  const { data: integration } = await sb
    .from('integrations_slack')
    .select('access_token_encrypted')
    .eq('org_id', orgId)
    .single()

  if (!integration || !integration.access_token_encrypted) {
    return NextResponse.json({ error: 'Not connected' }, { status: 404 })
  }

  const token = decrypt(integration.access_token_encrypted)
  if (!token) return NextResponse.json({ error: 'Token error' }, { status: 500 })

  const res = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=1000', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  
  const data = await res.json()
  if (!data.ok) {
    return NextResponse.json({ error: data.error }, { status: 500 })
  }

  const channels = data.channels.map((c: any) => ({
    id: c.id,
    name: c.name,
    is_private: c.is_private
  }))

  return NextResponse.json({ channels })
}
