import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured, supabaseServer } from '@lib/supabase'
import { logAuditEvent } from '@lib/db'
import { upsertType as memUpsertType } from '@lib/memory/leave'

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (role !== 'super_admin' && role !== 'org_admin') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const sb = isSupabaseConfigured() ? supabaseServer() : null
  const body = await req.json().catch(()=>({}))
  const org_id = body.org_id || body.orgId
  const code = body.code
  const name = body.name
  const description = body.description || ''
  const paid = !!body.paid
  const default_days_per_year = Number(body.default_days_per_year || 0)
  if (!org_id || !code || !name) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  if (!sb) {
    const item = memUpsertType({ org_id, code, name, description, paid, default_days_per_year })
    return NextResponse.json({ item })
  }
  const { data, error } = await sb.from('leave_types').upsert({ org_id, code, name, description, paid, default_days_per_year, is_active: true }).select('*').single()
  if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  try { const actor = req.headers.get('x-user-id') || undefined; const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-ip') || undefined; const ua = req.headers.get('user-agent') || undefined; await logAuditEvent({ orgId: org_id, actorUserId: actor, actorIp: ip || undefined, actorUserAgent: ua, eventType: 'leave.policy.changed', entityType: 'leave_type', entityId: String(data.id), metadata: { code, name, paid, default_days_per_year } }) } catch {}
  return NextResponse.json({ item: data })
}
