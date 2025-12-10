import { sendMail, verifyEmailConfig } from './mailer'
import { getNotificationPreferences, publishNotification, getUser, shouldSendForEvent } from './db'

export async function publish(input: { orgId: string, memberId?: string | null, type: 'system'|'attendance'|'payroll'|'device'|'agent'|'billing', title: string, message: string, meta?: any, eventType?: string }) {
  const allowInApp = input.memberId ? (input.eventType ? await shouldSendForEvent(String(input.memberId), String(input.eventType), 'in_app') : true) : true
  const created = allowInApp ? await publishNotification({ orgId: input.orgId, memberId: input.memberId ?? null, type: input.type, title: input.title, message: input.message, meta: input.meta }) : 'OK'
  if (typeof created === 'string') return created
  if (input.memberId) {
    const sendEmail = input.eventType ? await shouldSendForEvent(String(input.memberId), String(input.eventType), 'email') : (await getNotificationPreferences(input.memberId)).emailEnabled
    if (sendEmail) {
      const verify = await verifyEmailConfig()
      if (verify.status === 'OK') {
        const u = await getUser(input.memberId)
        if (u?.email) await sendMail(u.email, input.title, input.message)
      }
    }
  }
  return created
}
