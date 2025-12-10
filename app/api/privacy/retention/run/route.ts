import { NextRequest, NextResponse } from 'next/server'
import { runRetentionCleanup } from '@lib/db'

function allow(role: string) { return ['super_admin'].includes(role.toLowerCase()) }

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!allow(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const res = await runRetentionCleanup()
  return NextResponse.json(res)
}
