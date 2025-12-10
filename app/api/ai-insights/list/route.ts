import { NextRequest, NextResponse } from 'next/server'
import { listAIInsightSnapshots } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const org_id = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const target_type = (searchParams.get('target_type') || searchParams.get('targetType') || '') as 'org'|'department'|'member'|''
  const target_id = searchParams.get('target_id') || searchParams.get('targetId') || ''
  const period_start = searchParams.get('period_start') || searchParams.get('periodStart') || ''
  const period_end = searchParams.get('period_end') || searchParams.get('periodEnd') || ''
  const limit = Number(searchParams.get('limit') || 200)
  if (!org_id) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  const items = await listAIInsightSnapshots({ orgId: org_id, targetType: target_type || undefined, targetId: target_id || undefined, periodStart: period_start || undefined, periodEnd: period_end || undefined, limit })
  return NextResponse.json({ items })
}
