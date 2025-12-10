import { NextRequest, NextResponse } from 'next/server'
import { updateOrgPolicy } from '@lib/security'
import { logAuditEvent } from '@lib/db'

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
  try {
    const actor = req.headers.get('x-user-id') || undefined
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-ip') || undefined
    const ua = req.headers.get('user-agent') || undefined
    await logAuditEvent({ orgId, actorUserId: actor, actorIp: ip || undefined, actorUserAgent: ua, eventType: 'org.policy.updated', entityType: 'org_settings', entityId: orgId, metadata: patch })
  } catch {}
  return NextResponse.json({ policy })
}
