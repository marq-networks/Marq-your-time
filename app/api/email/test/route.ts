import { NextRequest, NextResponse } from 'next/server'
import { verifyEmailConfig, sendMail, sendTestMail } from '@lib/mailer'

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.to) return NextResponse.json({ error: 'MISSING_TO' }, { status: 400 })
  const verify = await verifyEmailConfig()
  let res
  if (verify.status === 'OK') res = await sendMail(body.to, body.subject || 'MARQ Test Email', body.html || '<div>MARQ email test</div>')
  else res = await sendTestMail(body.to, body.subject || 'MARQ Test Email', body.html || '<div>MARQ email test</div>')
  const status = res.status === 'OK' ? 200 : 500
  return NextResponse.json(res, { status })
}
