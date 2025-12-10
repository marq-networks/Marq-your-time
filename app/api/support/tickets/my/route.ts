import { NextRequest, NextResponse } from 'next/server'
import { listMySupportTickets } from '@lib/db'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const user_id = url.searchParams.get('user_id') || url.searchParams.get('userId') || req.headers.get('x-user-id') || ''
  if (!user_id) return NextResponse.json({ error: 'MISSING_USER' }, { status: 400 })
  const items = await listMySupportTickets(user_id)
  return NextResponse.json({ items })
}

