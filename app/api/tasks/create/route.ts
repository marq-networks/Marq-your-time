import { NextRequest, NextResponse } from 'next/server'
import { createTask } from '@lib/tracking_db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.org_id || !body.project_id || !body.title) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const task = await createTask({
    orgId: body.org_id,
    projectId: body.project_id,
    title: body.title,
    description: body.description,
    assigneeId: body.assignee_id,
    status: body.status || 'todo',
    priority: body.priority || 'medium',
    dueDate: body.due_date,
    estimatedHours: body.estimated_hours
  })
  if (!task) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json(task)
}