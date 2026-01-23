
import { NextResponse } from 'next/server'
import { sendSlack } from '@lib/slack'
import { supabaseServer } from '@lib/supabase'

export async function POST(req: Request) {
  try {
    const { orgId } = await req.json()
    
    // Check permissions
    const sb = supabaseServer()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    // Check if user is admin/owner
    const { data: member } = await sb.from('users').select('role_id').eq('id', user.id).eq('org_id', orgId).single()
    if (!member) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Send test message
    const result = await sendSlack(orgId, 'test_notification', {
      title: 'Test Notification',
      text: 'This is a test message from Marq Your Time to verify the Slack integration.',
      color: '#39ff14',
      fields: [
        { title: 'Sent By', value: `<@${user.id}>`, short: true },
        { title: 'Status', value: 'Working', short: true }
      ]
    })

    return NextResponse.json(result)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
