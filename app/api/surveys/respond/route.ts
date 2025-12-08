import { NextRequest, NextResponse } from 'next/server'
import { getSurveyDetail, submitSurveyResponses, getUser } from '@lib/db'

function allowed(role: string) { return ['member','admin','manager','owner','super_admin','hr'].includes(role) }

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const actor = req.headers.get('x-user-id') || ''
  if (!allowed(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json().catch(()=>({}))
  const survey_id = body.survey_id || body.surveyId
  const org_id = body.org_id || body.orgId
  const answers = Array.isArray(body.answers) ? body.answers : []
  if (!survey_id || !org_id || !actor || !answers.length) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const u = await getUser(actor)
  if (!u || String(u.orgId) !== String(org_id)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const s = await getSurveyDetail(survey_id)
  if (!s || String(s.survey.orgId) !== String(org_id)) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  const res = await submitSurveyResponses({ surveyId: survey_id, orgId: org_id, memberId: actor, answers: answers.map((a: any) => ({ questionId: a.question_id || a.questionId, answerText: a.answer_text || a.answerText, answerNumeric: a.answer_numeric ?? a.answerNumeric })) })
  if (res !== 'OK') return NextResponse.json({ error: res }, { status: 400 })
  return NextResponse.json({ ok: true })
}

