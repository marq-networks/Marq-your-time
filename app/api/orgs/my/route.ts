import { NextRequest, NextResponse } from 'next/server'
import { listUserOrganizations } from '@lib/db'

export async function GET(req: NextRequest) {
  const actor = req.headers.get('x-user-id') || ''
  if (!actor) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const items = await listUserOrganizations(actor)
  return NextResponse.json({ items })
}

