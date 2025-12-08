import { NextRequest, NextResponse } from 'next/server'
import { listSurveys, getSurveyResults, listUsers, listSurveyResponses } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const org_id = searchParams.get('org_id') || searchParams.get('orgId') || ''
  if (!org_id) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const surveys = await listSurveys(org_id)
  const users = await listUsers(org_id)
  const totalMembers = users.length
  const items: any[] = []
  for (const s of surveys) {
    const results = await getSurveyResults({ surveyId: s.id })
    const questions = results.questions || []
    let scaleAvg = 0
    let scaleCount = 0
    for (const q of questions) {
      if (q.questionType === 'scale') {
        scaleAvg += Number(q.avg || 0) * Number(q.count || 0)
        scaleCount += Number(q.count || 0)
      }
    }
    const avgScale = scaleCount ? scaleAvg / scaleCount : 0
    let responseRate: number | null = null
    if (!s.isAnonymous) {
      const resp = await listSurveyResponses(s.id)
      const distinctMembers = new Set(resp.map(r => r.memberId).filter(Boolean) as string[])
      responseRate = totalMembers ? Math.min(1, Math.max(0, distinctMembers.size / totalMembers)) : 0
    }
    items.push({ id: s.id, title: s.title, created_at: s.createdAt, closes_at: s.closesAt || null, is_anonymous: s.isAnonymous, avg_scale: avgScale, response_rate: responseRate })
  }
  return NextResponse.json({ items })
}
