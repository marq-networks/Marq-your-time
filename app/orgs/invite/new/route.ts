import { NextRequest, NextResponse } from 'next/server'
import { createOrgCreationInvite } from '@lib/db'

export async function GET(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (role !== 'super_admin') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const created = await createOrgCreationInvite({ createdBy: 'system' })
  if (created === 'DB_ERROR') return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  const host = req.headers.get('host') || 'localhost:3000'
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const url = `${proto}://${host}/orgs/invite/${created.token}`
  return NextResponse.redirect(url)
}

