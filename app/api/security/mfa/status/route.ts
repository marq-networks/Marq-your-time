import { NextRequest, NextResponse } from 'next/server'
import { getMFASettings, getOrgPolicy } from '@lib/security'
import { getUser } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id') || searchParams.get('userId') || (req.headers.get('x-user-id') || '')
  const orgId = searchParams.get('org_id') || searchParams.get('orgId') || (req.headers.get('x-org-id') || '')
  if (!userId || !orgId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const settings = await getMFASettings(userId)
  const policy = await getOrgPolicy(orgId)
  const user = await getUser(userId)
  const first_name = user?.firstName || null
  const last_name = user?.lastName || null
  const name = user ? `${user.firstName} ${user.lastName}`.trim() : null
  return NextResponse.json({ mfa: settings, require_mfa: policy.requireMfa, email: user?.email || null, first_name, last_name, name })
}
