import { NextRequest, NextResponse } from 'next/server'
import { createSurvey } from '@lib/db'

function allowed(role: string) { return ['admin','owner','manager','super_admin','hr'].includes(role) }

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const actor = req.headers.get('x-user-id') || ''
  if (!allowed(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json().catch(()=>({}))
  const org_id = body.org_id || body.orgId
  const title = body.title
  const description = body.description || null
  const is_anonymous = body.is_anonymous ?? body.isAnonymous
  const closes_at = body.closes_at || body.closesAt || null
  const questions = Array.isArray(body.questions) ? body.questions : []
  if (!org_id || !title || !actor || !questions.length) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await createSurvey({ orgId: org_id, title, description: description ?? undefined, isAnonymous: is_anonymous ?? true, createdBy: actor, closesAt: closes_at ?? undefined, questions: questions.map((q: any) => ({ questionType: q.question_type || q.questionType, questionText: q.question_text || q.questionText, options: q.options || undefined })) })
  if (res === 'DB_ERROR') return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ survey: res.survey, questions: res.questions })
}

