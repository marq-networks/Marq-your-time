import { NextRequest, NextResponse } from 'next/server'
import { listOrganizations, listUserOrganizations } from '@lib/db'

export async function GET(req: NextRequest) {
  const actor = req.headers.get('x-user-id') || ''
  const role = (req.headers.get('x-role') || '').toLowerCase()
  
  if (role === 'super_admin') {
    const items = await listOrganizations()
    return NextResponse.json({ items })
  }

  if (actor) {
    const items = await listUserOrganizations(actor)
    return NextResponse.json({ items })
  }

  return NextResponse.json({ success: false, error: 'FORBIDDEN', message: 'You do not have permission to perform this action.' }, { status: 403 })
}
