import { NextRequest, NextResponse } from 'next/server'
import { verifyMFA, saveTrustedDevice } from '@lib/security'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const userId = body.user_id || body.userId || (req.headers.get('x-user-id') || '')
  const orgId = body.org_id || body.orgId || (req.headers.get('x-org-id') || '')
  const code = body.code || body.otp || ''
  const trust = !!(body.trust_device ?? body.trustDevice)
  const ip = (req.headers.get('x-forwarded-for') || body.current_ip || body.currentIp || '').split(',')[0].trim()
  const ua = req.headers.get('user-agent') || body.user_agent || body.userAgent || ''
  if (!userId || !orgId || !code) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const ok = await verifyMFA(userId, orgId, code)
  if (!ok) return NextResponse.json({ verified: false }, { status: 401 })
  if (trust) await saveTrustedDevice(userId, ua, ip)
  return NextResponse.json({ verified: true })
}
