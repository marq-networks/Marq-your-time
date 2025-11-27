import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseServer } from '@lib/supabase'
import { sendMail, verifyEmailConfig } from '@lib/mailer'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supaEmail = cookieStore.get('supabase_user_email')?.value || ''
  if (!supaEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const subject = body.subject || 'MARQ Notification'
  const html = body.html || '<div>MARQ notification</div>'

  const verify = await verifyEmailConfig()
  if (verify.status !== 'OK') return NextResponse.json({ error: 'MAIL_NOT_CONFIGURED', verify }, { status: 400 })

  const admin = supabaseServer()
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200, page: 1 })
  if (listErr) return NextResponse.json({ error: 'LIST_USERS_FAILED', detail: String(listErr.message || listErr) }, { status: 500 })
  const { data: employees, error: empErr } = await admin.from('employees').select('user_id, full_name, department, role_title, phone')
  const empMap = new Map<string, { full_name?: string; department?: string; role_title?: string; phone?: string }>()
  for (const e of (employees || []) as any[]) empMap.set(e.user_id, { full_name: e.full_name || '', department: e.department || '', role_title: e.role_title || '', phone: e.phone || '' })

  const users = (list?.users || []).map((u: any) => ({
    id: u.id,
    userName: (empMap.get(u.id)?.full_name || u.user_metadata?.userName || ''),
    email: u.email,
    role: ((empMap.get(u.id)?.role_title || '').toLowerCase() === 'admin' ? 'admin' : 'employee'),
    department: empMap.get(u.id)?.department || '',
    title: empMap.get(u.id)?.role_title || '',
    phone: empMap.get(u.id)?.phone || '',
    status: (u.user_metadata?.status as string) || 'active',
    last_login_at: u.last_sign_in_at || null,
    onboarding: u.user_metadata?.onboarding || null,
  }))

  const recipients = users.filter(u => !!u.email).map(u => u.email as string)
  const results: any[] = []
  for (const to of recipients) {
    const res = await sendMail(to, subject, html)
    results.push({ to, ...res })
  }
  return NextResponse.json({ count: recipients.length, results })
}
