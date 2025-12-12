import { NextRequest, NextResponse } from 'next/server'
import { createOrganization, addOrgMembership, isSuperAdmin, listOrganizations } from '@lib/db'
import { isSupabaseConfigured } from '@lib/supabase'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const actor = req.headers.get('x-user-id') || ''
  if (!actor) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const role = (req.headers.get('x-role') || '').toLowerCase()
  let allowed = role === 'super_admin' ? true : await isSuperAdmin(actor)
  if (!allowed) {
    const sb = isSupabaseConfigured()
    const existing = sb ? await listOrganizations() : []
    const allowBootstrap = sb ? ((existing || []).length === 0) : true
    if (allowBootstrap) allowed = true
  }
  if (!allowed) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const b = await req.json().catch(()=>null)
  if (!b) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const ownerUserId = b.owner_user_id || b.ownerUserId || ''
  const input = {
    orgName: String(b.org_name || b.orgName || ''),
    orgLogo: b.org_logo || b.orgLogo || undefined,
    ownerName: String(b.owner_name || b.ownerName || ''),
    ownerEmail: String(b.owner_email || b.ownerEmail || ''),
    billingEmail: String(b.billing_email || b.billingEmail || ''),
    subscriptionType: String(b.subscription_type || b.subscriptionType || 'monthly'),
    pricePerLogin: Number(b.price_per_login ?? b.pricePerLogin ?? 0),
    totalLicensedSeats: Number(b.total_licensed_seats ?? b.totalLicensedSeats ?? 0),
    orgPasswordHash: (()=>{ const p = b.org_password || b.orgPassword || ''; return p ? crypto.createHash('sha256').update(String(p)).digest('hex') : undefined })()
  }
  if (!input.orgName || !input.ownerName || !input.ownerEmail || !input.billingEmail) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const created = await createOrganization(input as any)
  if (typeof created === 'string') return NextResponse.json({ error: created }, { status: 400 })
  if (ownerUserId) {
    await addOrgMembership(ownerUserId, created.id, 'owner')
  }
  return NextResponse.json({ org: created })
}
