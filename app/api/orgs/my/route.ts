import { NextRequest, NextResponse } from 'next/server'
import { listUserOrganizations } from '@lib/db'

export async function GET(req: NextRequest) {
  let actor = req.headers.get('x-user-id') || ''
  if (!actor) {
    actor = req.cookies.get('current_user_id')?.value || ''
  }
  if (!actor) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const items = await listUserOrganizations(actor)
  return NextResponse.json({ items })
}

