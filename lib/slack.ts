
import { supabaseServer } from '@lib/supabase'
import { decrypt } from './encryption'

export interface SlackIntegration {
  id: string
  org_id: string
  slack_team_id: string
  slack_team_name: string
  slack_bot_user_id: string
  access_token_encrypted: string
  is_enabled: boolean
}

export interface SlackSettings {
  id: string
  org_id: string
  default_channel_id: string
  default_channel_name: string
  notify_events: {
    timesheet_submitted: boolean
    timesheet_approved: boolean
    timesheet_rejected: boolean
    timesheet_changes_required: boolean
    smart_alerts: boolean
    missing_screenshots: boolean
    break_abuse: boolean
    absent_login: boolean
    payroll_generated: boolean
    [key: string]: boolean
  }
  mention_user_ids: string[]
  quiet_hours: { start: string; end: string; tz: string } | null
}

export async function sendSlack(orgId: string, event: string, payload: {
  title: string
  text: string
  color?: string // 'good', 'warning', 'danger' or hex
  fields?: { title: string; value: string; short?: boolean }[]
  actions?: { type: string; text: string; url: string; style?: string }[]
}) {
  const sb = supabaseServer()

  // 1. Fetch Integration & Settings
  const { data: integration } = await sb
    .from('integrations_slack')
    .select('*')
    .eq('org_id', orgId)
    .single()

  if (!integration || !integration.is_enabled || !integration.access_token_encrypted) {
    return { sent: false, reason: 'not_connected_or_disabled' }
  }

  const { data: settings } = await sb
    .from('integrations_slack_settings')
    .select('*')
    .eq('org_id', orgId)
    .single()

  if (!settings) {
    return { sent: false, reason: 'no_settings' }
  }

  // 2. Check Event Toggle
  if (!settings.notify_events[event]) {
    return { sent: false, reason: 'event_disabled' }
  }

  // 2.5 Check Quiet Hours
  if (settings.quiet_hours && settings.quiet_hours.start && settings.quiet_hours.end) {
    try {
      const tz = settings.quiet_hours.tz || 'UTC'
      const now = new Date()
      
      // Get current time in target timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
          hour: 'numeric',
          minute: 'numeric',
          hour12: false,
          timeZone: tz
      })
      
      const parts = formatter.formatToParts(now)
      const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
      const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0')
      const currentMinutes = hour * 60 + minute
      
      const [startH, startM] = settings.quiet_hours.start.split(':').map(Number)
      const [endH, endM] = settings.quiet_hours.end.split(':').map(Number)
      const startMinutes = startH * 60 + startM
      const endMinutes = endH * 60 + endM
      
      let inQuietHours = false
      if (startMinutes <= endMinutes) {
          // Range within same day, e.g. 13:00 to 14:00
          inQuietHours = currentMinutes >= startMinutes && currentMinutes < endMinutes
      } else {
          // Range spans midnight, e.g. 22:00 to 08:00
          inQuietHours = currentMinutes >= startMinutes || currentMinutes < endMinutes
      }
      
      if (inQuietHours) {
          return { sent: false, reason: 'quiet_hours' }
      }
    } catch (e) {
      console.error('Error checking quiet hours:', e)
      // Continue sending if check fails
    }
  }

  // 3. Decrypt Token
  const token = decrypt(integration.access_token_encrypted)
  if (!token) {
    console.error('Failed to decrypt Slack token for org', orgId)
    return { sent: false, reason: 'token_error' }
  }

  // 4. Construct Message
  // Handle Mentions
  let mentions = ''
  if (settings.mention_user_ids && settings.mention_user_ids.length > 0) {
    mentions = settings.mention_user_ids.map((id: string) => `<@${id}>`).join(' ') + ' '
  }

  const attachments = [
    {
      color: payload.color || '#39ff14', // Default to neon green
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${payload.title}*\n${payload.text}`
          }
        },
        ...(payload.fields ? [{
          type: 'section',
          fields: payload.fields.map(f => ({
            type: 'mrkdwn',
            text: `*${f.title}*\n${f.value}`
          }))
        }] : []),
        ...(payload.actions ? [{
          type: 'actions',
          elements: payload.actions.map(a => ({
            type: 'button',
            text: {
              type: 'plain_text',
              text: a.text
            },
            url: a.url,
            style: a.style === 'danger' ? 'danger' : (a.style === 'primary' ? 'primary' : undefined)
          }))
        }] : [])
      ]
    }
  ]

  // 5. Send
  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        channel: settings.default_channel_id,
        text: `${mentions}${payload.title}`, // Fallback text
        attachments: attachments
      })
    })

    const data = await res.json()
    if (!data.ok) {
      console.error('Slack API error:', data.error)
      return { sent: false, reason: `slack_api_${data.error}` }
    }
    return { sent: true }

  } catch (e) {
    console.error('Slack send error:', e)
    return { sent: false, reason: 'network_error' }
  }
}
