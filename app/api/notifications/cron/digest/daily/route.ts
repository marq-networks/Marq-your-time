import { NextRequest, NextResponse } from 'next/server'
import { listDigestUsers, listNotificationsForUserBetween, getUser } from '@lib/db'
import { verifyEmailConfig, sendMail } from '@lib/mailer'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || (()=>{ const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10) })()
  const startISO = `${date}T00:00:00.000Z`
  const endISO = `${date}T23:59:59.999Z`
  const users = await listDigestUsers('daily')
  const verify = await verifyEmailConfig()
  let sent = 0
  if (verify.status === 'OK') {
    for (const uid of users) {
      const items = await listNotificationsForUserBetween(uid, startISO, endISO)
      if (!items.length) continue
      const u = await getUser(uid)
      if (!u?.email) continue
      const lines = items.map(i => `<div><span class="tag-pill accent">${i.type}</span> <strong>${i.title}</strong><div>${i.message}</div><div style="opacity:0.7">${new Date(i.createdAt).toLocaleString()}</div></div>`).join('')
      const html = `<div><h3>Daily digest for ${date}</h3>${lines}</div>`
      const res = await sendMail(u.email, `Daily digest for ${date}`, html)
      if ((res as any).status === 'OK') sent += 1
    }
  }
  return NextResponse.json({ date, users: users.length, sent, status: verify.status })
}
