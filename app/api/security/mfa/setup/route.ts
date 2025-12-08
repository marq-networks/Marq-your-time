import { NextRequest, NextResponse } from 'next/server'
import { setupMFA } from '@lib/security'
import { getUser } from '@lib/db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const userId = body.user_id || body.userId || (req.headers.get('x-user-id') || '')
  const orgId = body.org_id || body.orgId || (req.headers.get('x-org-id') || '')
  const mfaType = body.mfa_type || body.mfaType
  if (!userId || !orgId || !mfaType) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  if (!['email_otp','totp'].includes(mfaType)) return NextResponse.json({ error: 'INVALID_TYPE' }, { status: 400 })
  const user = await getUser(userId)
  const label = user ? `${user.email}` : userId
  const res = await setupMFA(userId, mfaType, label)
  return NextResponse.json(res)
}
