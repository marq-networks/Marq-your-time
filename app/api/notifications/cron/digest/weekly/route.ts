import { NextRequest, NextResponse } from 'next/server'
import { listDigestUsers, listNotificationsForUserBetween, getUser } from '@lib/db'
import { verifyEmailConfig, sendMail } from '@lib/mailer'

function rangeForWeek(refISO?: string) {
  const ref = refISO ? new Date(refISO) : new Date()
  const end = new Date(ref)
  end.setDate(end.getDate() - 1)
  const start = new Date(end)
  start.setDate(start.getDate() - 6)
  const s = start.toISOString().slice(0,10)
  const e = end.toISOString().slice(0,10)
  return { startISO: `${s}T00:00:00.000Z`, endISO: `${e}T23:59:59.999Z`, label: `${s} – ${e}` }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ref = searchParams.get('refDate') || undefined
  const { startISO, endISO, label } = rangeForWeek(ref || undefined)
  const users = await listDigestUsers('weekly')
  const verify = await verifyEmailConfig()
  let sent = 0
  if (verify.status === 'OK') {
    for (const uid of users) {
      const items = await listNotificationsForUserBetween(uid, startISO, endISO)
      if (!items.length) continue
      const u = await getUser(uid)
      if (!u?.email) continue
      const lines = items.map(i => `<div><span class="tag-pill accent">${i.type}</span> <strong>${i.title}</strong><div>${i.message}</div><div style="opacity:0.7">${new Date(i.createdAt).toLocaleString()}</div></div>`).join('')
      const html = `<div><h3>Weekly digest ${label}</h3>${lines}</div>`
      const res = await sendMail(u.email, `Weekly digest ${label}`, html)
      if ((res as any).status === 'OK') sent += 1
    }
  }
  return NextResponse.json({ range: label, users: users.length, sent, status: verify.status })
}
