import { NextRequest, NextResponse } from 'next/server'
import { returnAsset } from '@lib/db'

function allow(role: string) { return ['admin','owner','it','super_admin'].includes(role) }

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!allow(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json()
  const assignment_id = body.assignment_id || body.assignmentId || ''
  const asset_id = body.asset_id || body.assetId || ''
  if (!assignment_id && !asset_id) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await returnAsset({ assignmentId: assignment_id || undefined, assetId: asset_id || undefined })
  if (res !== 'OK') return NextResponse.json({ error: res }, { status: 400 })
  return NextResponse.json({ success: true })
}

