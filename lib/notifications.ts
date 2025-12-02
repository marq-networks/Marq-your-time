import { sendMail, verifyEmailConfig } from './mailer'
import { getNotificationPreferences, publishNotification, getUser } from './db'

export async function publish(input: { orgId: string, memberId?: string | null, type: 'system'|'attendance'|'payroll'|'device'|'agent'|'billing', title: string, message: string, meta?: any }) {
  const created = await publishNotification({ orgId: input.orgId, memberId: input.memberId ?? null, type: input.type, title: input.title, message: input.message, meta: input.meta })
  if (typeof created === 'string') return created
  if (input.memberId) {
    const prefs = await getNotificationPreferences(input.memberId)
    if (prefs.emailEnabled) {
      const verify = await verifyEmailConfig()
      if (verify.status === 'OK') {
        const u = await getUser(input.memberId)
        if (u?.email) await sendMail(u.email, input.title, input.message)
      }
    }
  }
  return created
}
