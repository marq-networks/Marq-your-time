import { NextRequest, NextResponse } from 'next/server'
import { getDigestFrequency } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const member_id = searchParams.get('member_id') || searchParams.get('memberId') || ''
  if (!member_id) return NextResponse.json({ error: 'MISSING_MEMBER' }, { status: 400 })
  const frequency = await getDigestFrequency(member_id)
  return NextResponse.json({ frequency })
}

