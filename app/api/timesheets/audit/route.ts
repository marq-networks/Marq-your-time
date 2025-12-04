import { NextRequest, NextResponse } from 'next/server'
import { listTimesheetAudit } from '@lib/db'

export async function GET(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const actor = req.headers.get('x-user-id') || ''
  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('member_id') || searchParams.get('memberId') || ''
  const date = searchParams.get('date') || undefined
  if (!memberId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const allowed = ['admin','manager','owner','super_admin']
  if (!(allowed.includes(role) || actor === memberId)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const items = await listTimesheetAudit(memberId, date || undefined)
  if (typeof items === 'string') return NextResponse.json({ error: items }, { status: items === 'SUPABASE_REQUIRED' ? 500 : 400 })
  return NextResponse.json({ items })
}
