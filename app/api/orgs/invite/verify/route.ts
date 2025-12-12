import { NextRequest, NextResponse } from 'next/server'
import { getOrgCreationInvite } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token') || ''
  if (!token) return NextResponse.json({ error: 'MISSING_TOKEN' }, { status: 400 })
  const inv = await getOrgCreationInvite(String(token))
  if (typeof inv === 'string') return NextResponse.json({ error: inv }, { status: 400 })
  return NextResponse.json({ token: inv.token, invited_email: inv.invitedEmail || null, expires_at: new Date(inv.expiresAt).toISOString() })
}

