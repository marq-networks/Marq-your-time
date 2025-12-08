import { NextRequest, NextResponse } from 'next/server'
import { updateOrgPolicy } from '@lib/security'

function allow(role: string) { return ['admin','owner','super_admin'].includes(role.toLowerCase()) }

export async function POST(req: NextRequest) {
  const body = await req.json()
  const orgId = body.org_id || body.orgId || (req.headers.get('x-org-id') || '')
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!orgId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  if (!allow(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const patch = {
    requireMfa: !!(body.require_mfa ?? body.requireMfa),
    sessionTimeoutMinutes: body.session_timeout_minutes ?? body.sessionTimeoutMinutes,
    allowedIpRanges: body.allowed_ip_ranges ?? body.allowedIpRanges
  }
  const policy = await updateOrgPolicy(orgId, patch)
  return NextResponse.json({ policy })
}
