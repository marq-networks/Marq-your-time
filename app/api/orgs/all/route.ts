import { NextRequest, NextResponse } from 'next/server'
import { isSuperAdmin, listOrganizations } from '@lib/db'

export async function GET(req: NextRequest) {
  const actor = req.headers.get('x-user-id') || ''
  if (!actor) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const allowed = await isSuperAdmin(actor)
  if (!allowed) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const items = await listOrganizations()
  return NextResponse.json({ items })
}

