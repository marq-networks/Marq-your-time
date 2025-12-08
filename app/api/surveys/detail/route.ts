import { NextRequest, NextResponse } from 'next/server'
import { getSurveyDetail } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const survey_id = searchParams.get('survey_id') || searchParams.get('surveyId') || ''
  if (!survey_id) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const detail = await getSurveyDetail(survey_id)
  if (!detail) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ survey: detail.survey, questions: detail.questions })
}

