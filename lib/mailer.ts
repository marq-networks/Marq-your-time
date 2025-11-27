import nodemailer, { getTestMessageUrl } from 'nodemailer'

function pickEnv(...keys: string[]) {
  for (const k of keys) {
    const v = process.env[k]
    if (v !== undefined && v !== '') return v
  }
  return undefined
}

function resolvedConfig() {
  const host = pickEnv('SMTP_HOST','EMAIL_HOST')
  const port = pickEnv('SMTP_PORT','EMAIL_PORT')
  const user = pickEnv('SMTP_USER','EMAIL_USER','SMTP_USERNAME','EMAIL_USERNAME')
  const pass = pickEnv('SMTP_PASS','EMAIL_PASS','SMTP_PASSWORD','EMAIL_PASSWORD')
  const from = pickEnv('MAIL_FROM','EMAIL_FROM','FROM_EMAIL','ADMIN_NOTIFY_EMAIL')
  return { host, port: port ? Number(port) : undefined, user, pass, from }
}

export function listMissingEmailEnv() {
  const cfg = resolvedConfig()
  const missing: string[] = []
  if (!cfg.host) missing.push('SMTP_HOST')
  if (!cfg.port) missing.push('SMTP_PORT')
  if (!cfg.user) missing.push('SMTP_USER')
  if (!cfg.pass) missing.push('SMTP_PASS')
  if (!cfg.from) missing.push('MAIL_FROM')
  return missing
}

function isEmailConfigured() {
  return listMissingEmailEnv().length === 0
}

function buildTransport() {
  const cfg = resolvedConfig()
  return nodemailer.createTransport({
    host: cfg.host as string,
    port: cfg.port as number,
    secure: (cfg.port as number) === 465,
    auth: { user: cfg.user as string, pass: cfg.pass as string }
  })
}

export async function verifyEmailConfig() {
  if (!isEmailConfigured()) return { status: 'MAIL_NOT_CONFIGURED', missing: listMissingEmailEnv() }
  const transporter = buildTransport()
  try {
    await transporter.verify()
    return { status: 'OK' }
  } catch (e: any) {
    return { status: 'ERROR', error: String(e?.message || e) }
  }
}

export async function sendInviteMail(to: string, subject: string, html: string) {
  if (!isEmailConfigured()) return { status: 'MAIL_NOT_CONFIGURED', missing: listMissingEmailEnv() }
  const transporter = buildTransport()
  try {
    const cfg = resolvedConfig()
    const info = await transporter.sendMail({ from: cfg.from as string, to, subject, html })
    return { status: 'OK', messageId: info.messageId, accepted: info.accepted, rejected: info.rejected }
  } catch (e: any) {
    return { status: 'ERROR', error: String(e?.message || e) }
  }
}
export async function sendMail(to: string, subject: string, html: string) {
  return sendInviteMail(to, subject, html)
}
export async function sendTestMail(to: string, subject: string, html: string) {
  const acc = await nodemailer.createTestAccount()
  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: { user: acc.user, pass: acc.pass }
  })
  try {
    const info = await transporter.sendMail({ from: 'MARQ Test <test@marq.local>', to, subject, html })
    const url = getTestMessageUrl(info)
    return { status: 'OK', messageId: info.messageId, accepted: info.accepted, rejected: info.rejected, previewUrl: url }
  } catch (e: any) {
    return { status: 'ERROR', error: String(e?.message || e) }
  }
}
