import { NextRequest, NextResponse } from 'next/server'
import { getPrivacySettings, updatePrivacySettings } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('member_id') || searchParams.get('memberId') || ''
  const orgId = searchParams.get('org_id') || searchParams.get('orgId') || ''
  if (!memberId || !orgId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const s = await getPrivacySettings(memberId, orgId)
  return NextResponse.json({ settings: s })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const memberId = body.member_id || body.memberId
  const orgId = body.org_id || body.orgId
  const allowActivityTracking = !!(body.allow_activity_tracking ?? body.allowActivityTracking)
  const allowScreenshots = !!(body.allow_screenshots ?? body.allowScreenshots)
  const maskPersonalWindows = (body.mask_personal_windows ?? body.maskPersonalWindows) !== false
  const actor = req.headers.get('x-user-id') || undefined
  if (!memberId || !orgId) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await updatePrivacySettings({ memberId, orgId, allowActivityTracking, allowScreenshots, maskPersonalWindows, actorUserId: actor })
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 500 })
  return NextResponse.json({ settings: res })
}

