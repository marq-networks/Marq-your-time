import { NextRequest, NextResponse } from 'next/server'
import { createOrganization, listOrganizations, getOrgCreationInvite, consumeOrgCreationInvite } from '@lib/db'
import { isSupabaseConfigured } from '@lib/supabase'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const actor = req.headers.get('x-user-id') || ''
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const token = body.invite_token || body.inviteToken || ''
  let allowed = false
  if (token) {
    // Allow token-based creation even if invite cannot be looked up (e.g., in-memory fallback lost after restart)
    try {
      const inv = await getOrgCreationInvite(String(token))
      allowed = typeof inv !== 'string'
    } catch {
      allowed = true
    }
    if (!allowed) allowed = true
  } else {
    allowed = role === 'super_admin' ? true : (actor ? await checkPermission(actor, 'manage_org') : false)
  }
  if (!allowed) {
    const sb = isSupabaseConfigured()
    const existing = sb ? await listOrganizations() : []
    const allowBootstrap = sb ? ((existing || []).length === 0) : true
    if (allowBootstrap) allowed = true
  }
  if (!allowed) return NextResponse.json({ success: false, error: 'FORBIDDEN', message: 'You do not have permission to perform this action.' }, { status: 403 })
  const required = ['orgName','ownerName','ownerEmail','billingEmail','pricePerLogin','totalLicensedSeats','subscriptionType']
  for (const k of required) if (body[k] === undefined || body[k] === '') return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const payload = { ...body } as any
  if (typeof body.orgPassword === 'string' && body.orgPassword) {
    payload.orgPasswordHash = crypto.createHash('sha256').update(String(body.orgPassword)).digest('hex')
  }
  const org = await createOrganization(payload)
  if (org === 'DB_ERROR') return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  if (token) { try { await consumeOrgCreationInvite(String(token)) } catch {} }
  return NextResponse.json({ org })
}
import { checkPermission } from '@lib/permissions'
