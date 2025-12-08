import { NextRequest, NextResponse } from 'next/server'
import { getSurveyDetail, getSurveyResults } from '@lib/db'

function allowed(role: string) { return ['admin','owner','manager','super_admin','hr'].includes(role) }

export async function GET(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!allowed(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const { searchParams } = new URL(req.url)
  const survey_id = searchParams.get('survey_id') || searchParams.get('surveyId') || ''
  const group_by = (searchParams.get('group_by') || searchParams.get('groupBy') || '').toLowerCase() as 'department'|'role'|''
  if (!survey_id) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const detail = await getSurveyDetail(survey_id)
  if (!detail) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const res = await getSurveyResults({ surveyId: survey_id, groupBy: group_by || undefined })
  return NextResponse.json(res)
}

