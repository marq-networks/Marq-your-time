import { NextRequest, NextResponse } from 'next/server'
import { listAiInsights } from '@/lib/ai/data'
import { InsightType, InsightSeverity, InsightStatus } from '@/lib/ai/types'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('orgId')
  const userId = searchParams.get('userId')
  const insightType = searchParams.get('insightType') as InsightType | null
  const severity = searchParams.get('severity') as InsightSeverity | null
  const status = searchParams.get('status') as InsightStatus | null
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const limit = Number(searchParams.get('limit') || 100)
  const orgWideOnly = searchParams.get('orgWideOnly') === 'true'

  if (!orgId) {
    return NextResponse.json({ error: 'Missing orgId' }, { status: 400 })
  }

  try {
    const items = await listAiInsights({
      orgId,
      userId: orgWideOnly ? (null as any) : (userId || undefined),
      insightType: insightType || undefined,
      severity: severity || undefined,
      status: status || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      limit
    })
    return NextResponse.json({ items })
  } catch (error: any) {
    console.error('List AI Insights Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
