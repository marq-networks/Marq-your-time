import { NextRequest, NextResponse } from 'next/server'
import { getSupportTicketDetail } from '@lib/db'

function allow(role: string) { return ['admin','owner','hr','it','super_admin','manager','employee'].includes(role.toLowerCase()) }

export async function GET(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!allow(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const url = new URL(req.url)
  const id = url.searchParams.get('id') || url.searchParams.get('ticket_id') || ''
  if (!id) return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })
  const res = await getSupportTicketDetail(String(id))
  if (res === 'NOT_FOUND') return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json(res)
}

