import { NextRequest, NextResponse } from 'next/server'
import { listTrustedDevices } from '@lib/security'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id') || searchParams.get('userId') || (req.headers.get('x-user-id') || '')
  if (!userId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const items = await listTrustedDevices(userId)
  return NextResponse.json({ items })
}
