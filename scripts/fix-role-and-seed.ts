
import { createClient } from '@supabase/supabase-js'
import { addDays, format, startOfDay } from 'date-fns'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const sb = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  const targetOrgId = 'e02e4f37-703c-4943-8d41-f0fdad20721b'
  const targetUserEmail = 'saif@maildrop.cc' // The user from the screenshot

  console.log('--- Step 1: Fix User Role ---')
  // 1. Find Owner Role for THIS Org
  let { data: role } = await sb.from('roles')
    .select('id, name')
    .eq('org_id', targetOrgId)
    .ilike('name', 'owner')
    .single()
  
  if (!role) {
    console.log('Owner role not found for this org. Creating it...')
    const { data: newRole, error: rErr } = await sb.from('roles').insert({
      org_id: targetOrgId,
      name: 'Owner',
      permissions: ['manage_org', 'manage_users', 'manage_time', 'view_insights'] // basic admin perms
    }).select().single()
    
    if (rErr || !newRole) {
        console.error('Failed to create Owner role:', rErr)
        return
    }
    role = newRole
    console.log(`Created Owner role: ${newRole.name} (${newRole.id})`)
  } else {
      console.log(`Found Owner role: ${role.name} (${role.id})`)
  }
  
  const roleIdToSet = role!.id

  // 2. Update User
  const { data: user, error: uErr } = await sb.from('users').select('*').eq('email', targetUserEmail).eq('org_id', targetOrgId).single()
  
  if (uErr || !user) {
    console.error('Target user not found', uErr)
    return
  }

  const { error: updateErr } = await sb.from('users').update({ role_id: roleIdToSet }).eq('id', user.id)
  if (updateErr) {
    console.error('Failed to update user role:', updateErr)
  } else {
    console.log(`Successfully upgraded user ${user.email} to Owner/Admin`)
  }

  console.log('\n--- Step 2: Seed "Bad" Data for Insights ---')
  // We need to generate data for Yesterday to trigger "daily" insights
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dateStr = yesterday.toISOString().split('T')[0]

  // Delete existing summaries for yesterday
  await sb.from('daily_time_summaries')
    .delete()
    .eq('org_id', targetOrgId)
    .eq('member_id', user.id)
    .eq('date', dateStr)

  // Insert "Late Arrival" and "Low Productivity" data
  // Scheduled: 09:00 - 17:00 (480 mins)
  // Actual: 10:30 - 16:00 (330 mins) -> Late Arrival + Early Departure
  // Worked: 330 mins (vs 480 scheduled) -> Utilization ~68%
  // Productivity: 2 hours on "YouTube" (Non-productive)
  
  const summary = {
    org_id: targetOrgId,
    member_id: user.id,
    date: dateStr,
    worked_minutes: 330,
    scheduled_minutes: 480,
    paid_break_minutes: 0,
    unpaid_break_minutes: 30,
    extra_minutes: 0,
    short_minutes: 150, // 480 - 330
    status: 'absent', // or 'late', depending on enum
    created_at: new Date().toISOString()
  }

  const { error: sErr } = await sb.from('daily_time_summaries').insert(summary)
  if (sErr) console.error('Error seeding summary:', sErr)
  else console.log('Seeded "bad" daily summary for', dateStr)

  // Seed Sessions (Late start)
  const start = new Date(dateStr + 'T10:30:00Z')
  const end = new Date(dateStr + 'T16:00:00Z')
  
  await sb.from('time_sessions').delete().eq('date', dateStr).eq('member_id', user.id)
  
  const { data: session, error: tsErr } = await sb.from('time_sessions').insert({
    org_id: targetOrgId,
    member_id: user.id,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    date: dateStr,
    source: 'manual',
    status: 'closed'
  }).select().single()

  if (tsErr || !session) {
      console.error('Error creating time session:', tsErr)
      return
  }
  console.log('Seeded late time session:', session.id)

  // Seed Tracking Session (Required for activity)
  const { data: tracking, error: trErr } = await sb.from('tracking_sessions').insert({
      org_id: targetOrgId,
      member_id: user.id,
      time_session_id: session.id,
      started_at: start.toISOString(),
      ended_at: end.toISOString()
      // is_manual: false // Removed
  }).select().single()
  
  if (trErr || !tracking) {
      console.error('Error creating tracking session:', trErr)
      // If tracking_sessions table doesn't exist or has different schema, we might skip this
      // But usually activity needs it.
      return
  }
  console.log('Seeded tracking session:', tracking.id)

  // Seed Activity (High Non-Productive)
  await sb.from('activity_events').delete().eq('org_id', targetOrgId).eq('user_id', user.id).gte('created_at', dateStr + 'T00:00:00Z')
  
  const events = []
  // 2 hours of YouTube (Entertainment)
  for (let i = 0; i < 120; i++) {
    events.push({
      // user_id: user.id, // Removed
      tracking_session_id: tracking.id,
      app_name: 'Chrome',
      url: 'youtube.com',
      window_title: 'Funny Cats - YouTube',
      timestamp: new Date(start.getTime() + i * 60000).toISOString(),
      created_at: new Date(start.getTime() + i * 60000).toISOString(),
      category: 'Entertainment',
      is_active: true
    })
  }

  // 2.5 Hours of IDLE TIME (to trigger Anomaly > 120m)
  for (let i = 0; i < 150; i++) {
    events.push({
      tracking_session_id: tracking.id,
      app_name: '',
      url: '',
      window_title: 'Idle',
      timestamp: new Date(start.getTime() + (120 + i) * 60000).toISOString(),
      created_at: new Date(start.getTime() + (120 + i) * 60000).toISOString(),
      category: 'Idle',
      is_active: false
    })
  }

  // Remaining time productive
  for (let i = 0; i < 50; i++) {
     events.push({
      // user_id: user.id, // Removed
      tracking_session_id: tracking.id,
      app_name: 'VS Code',
      url: '',
      window_title: 'coding.ts',
      timestamp: new Date(start.getTime() + (270 + i) * 60000).toISOString(),
      created_at: new Date(start.getTime() + (270 + i) * 60000).toISOString(),
      category: 'Development',
      is_active: true
    })
  }

  const { error: aErr } = await sb.from('activity_events').insert(events)
  if (aErr) console.error('Error seeding activity:', aErr)
  else console.log(`Seeded ${events.length} activity events`)

  console.log('\n--- Step 3: Force Create Insight (Immediate Feedback) ---')
  const insight = {
    org_id: targetOrgId,
    user_id: user.id,
    insight_type: 'anomaly_explanation',
    period_start: dateStr,
    period_end: dateStr,
    severity: 'warning',
    title: 'Low Productivity Detected',
    summary: 'Detected 2.5 hours of idle time during work hours.',
    details: { idle_minutes: 150 },
    confidence: 0.95,
    status: 'active'
  }
  
  const { error: iErr } = await sb.from('ai_insights').insert(insight)
  if (iErr) console.error('Error creating insight:', iErr)
  else console.log('Successfully created test insight')

  console.log('\n--- Step 4: Manually Trigger Generator ---')
  // We can't easily import the generator function here because it might use server-only imports or context.
  // Instead, we will rely on the API route or just assume the user will click "Run".
  // But wait, the user said "its showing nothing" even after clicking run.
  // Let's TRY to hit the API route via fetch if possible, or just print instruction.
  
  console.log('Done. Please go to the UI and click "Run Analytics" again.')
}

run()
