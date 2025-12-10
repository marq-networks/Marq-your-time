import { NextRequest, NextResponse } from 'next/server'
import { upsertRetentionPolicies, logAuditEvent } from '@lib/db'

function allow(role: string) { return ['admin','owner','super_admin'].includes(role.toLowerCase()) }

export async function POST(req: NextRequest) {
  const body = await req.json().catch(()=>({}))
  const org_id = body.org_id || body.orgId
  const policies = Array.isArray(body.policies) ? body.policies : []
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!org_id) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  if (!allow(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const res = await upsertRetentionPolicies(org_id, policies.map((p: any) => ({ category: p.category, retentionDays: Number(p.retention_days ?? p.retentionDays ?? 0), hardDelete: !!(p.hard_delete ?? p.hardDelete) })))
  if (res === 'DB_ERROR') return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  try {
    const actor = req.headers.get('x-user-id') || undefined
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-ip') || undefined
    const ua = req.headers.get('user-agent') || undefined
    await logAuditEvent({ orgId: org_id, actorUserId: actor, actorIp: ip || undefined, actorUserAgent: ua, eventType: 'privacy.retention_policy.updated', entityType: 'org_settings', entityId: org_id, metadata: { policies } })
  } catch {}
  return NextResponse.json({ items: res })
}
