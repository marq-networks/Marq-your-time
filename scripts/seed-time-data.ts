
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const sb = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  // 1. Get the specific user from the screenshot's Org
  // Org ID: e02e4f37-703c-4943-8d41-f0fdad20721b
  const targetOrgId = 'e02e4f37-703c-4943-8d41-f0fdad20721b'
  const { data: users, error: uErr } = await sb
    .from('users')
    .select('*')
    .eq('org_id', targetOrgId)
    .limit(1)
  
  if (uErr || !users || users.length === 0) {
    console.error('User not found in target org!', uErr)
    return
  }
  const user = users[0]
  console.log(`Seeding data for user ${user.id} in org ${user.org_id}`)

  // 1. Create Daily Time Summaries for last 7 days
  const summaries = []
  const today = new Date()
  
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    
    // Vary worked minutes
    const worked = 300 + Math.floor(Math.random() * 200) // 5h to 8.3h
    
    summaries.push({
      org_id: user.org_id,
      member_id: user.id,
      date: dateStr,
      worked_minutes: worked,
      scheduled_minutes: 480,
      paid_break_minutes: 0,
      unpaid_break_minutes: 30,
      extra_minutes: 0,
      short_minutes: 0,
      status: 'normal',
      created_at: new Date().toISOString()
    })
  }

  // Delete existing summaries for this period to avoid duplicates
  const start = summaries[0].date
  const end = summaries[summaries.length-1].date
  await sb.from('daily_time_summaries')
    .delete()
    .eq('org_id', user.org_id)
    .eq('member_id', user.id)
    .gte('date', start)
    .lte('date', end)

  // Insert summaries
  const { error: sErr } = await sb.from('daily_time_summaries').insert(summaries)
  if (sErr) console.error('Error seeding summaries:', sErr)
  else console.log('Seeded daily summaries')

  // 2. Create a long open session (to trigger "Missing Checkout" candidate)
  const longStart = new Date()
  longStart.setDate(longStart.getDate() - 2) // 2 days ago
  
  const { data: session, error: sessErr } = await sb.from('time_sessions').insert({
    org_id: user.org_id,
    member_id: user.id,
    start_time: longStart.toISOString(),
    end_time: null, // Open
    date: longStart.toISOString().split('T')[0],
    source: 'manual',
    status: 'open'
  }).select().single()

  if (sessErr) console.error('Error creating open session:', sessErr)
  else console.log('Created open session for missing checkout detection')

  // 3. Create dummy activity for "Top Apps"
  // We need a tracking session first
  if (session) {
      const { data: ts } = await sb.from('tracking_sessions').insert({
          org_id: user.org_id,
          member_id: user.id,
          time_session_id: session.id,
          started_at: longStart.toISOString()
      }).select().single()

      if (ts) {
          await sb.from('activity_events').insert([
              { tracking_session_id: ts.id, is_active: true, app_name: 'VS Code', url: 'File A', timestamp: new Date().toISOString() },
              { tracking_session_id: ts.id, is_active: true, app_name: 'VS Code', url: 'File B', timestamp: new Date().toISOString() },
              { tracking_session_id: ts.id, is_active: true, app_name: 'Slack', url: 'Channel', timestamp: new Date().toISOString() },
              { tracking_session_id: ts.id, is_active: false, app_name: '', url: '', timestamp: new Date().toISOString() } // Idle
          ])
          console.log('Seeded activity events')
      }
  }

  console.log('Seed complete. Now click "Run Analysis" in the UI.')
}

run()
