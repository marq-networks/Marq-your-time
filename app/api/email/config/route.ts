import { NextResponse } from 'next/server'
import { listMissingEmailEnv, verifyEmailConfig } from '@lib/mailer'

export async function GET() {
  const verify = await verifyEmailConfig()
  const missing = listMissingEmailEnv()
  const present = {
    SMTP_HOST: !!process.env.SMTP_HOST || !!process.env.EMAIL_HOST,
    SMTP_PORT: !!process.env.SMTP_PORT || !!process.env.EMAIL_PORT,
    SMTP_USER: !!process.env.SMTP_USER || !!process.env.EMAIL_USER || !!process.env.SMTP_USERNAME || !!process.env.EMAIL_USERNAME,
    SMTP_PASS: !!process.env.SMTP_PASS || !!process.env.EMAIL_PASS || !!process.env.SMTP_PASSWORD || !!process.env.EMAIL_PASSWORD,
    MAIL_FROM: !!process.env.MAIL_FROM || !!process.env.EMAIL_FROM || !!process.env.FROM_EMAIL || !!process.env.ADMIN_NOTIFY_EMAIL,
  }
  return NextResponse.json({ status: verify.status, missing, present })
}
