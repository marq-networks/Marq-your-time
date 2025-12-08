import { NextRequest, NextResponse } from 'next/server'
import { assignAssetToMember } from '@lib/db'

function allow(role: string) { return ['admin','owner','it','super_admin'].includes(role) }

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!allow(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json()
  const asset_id = body.asset_id || body.assetId || ''
  const member_id = body.member_id || body.memberId || ''
  if (!asset_id || !member_id) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await assignAssetToMember({ assetId: asset_id, memberId: member_id })
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 400 })
  return NextResponse.json({ assignment: res })
}

