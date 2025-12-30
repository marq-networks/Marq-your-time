import { NextRequest, NextResponse } from 'next/server'
import { listAllOrgMembers, listUserOrganizations, isSuperAdmin } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('orgId')
  if (!orgId) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })

  const actor = req.headers.get('x-user-id') || ''
  if (!actor) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  let allowed = false
  if (await isSuperAdmin(actor)) {
    allowed = true
  } else {
    const myOrgs = await listUserOrganizations(actor)
    if (myOrgs.some(o => o.id === orgId)) allowed = true
  }

  if (!allowed) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

  const items = await listAllOrgMembers(orgId)
  return NextResponse.json({ items })
}

