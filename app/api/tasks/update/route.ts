import { NextRequest, NextResponse } from 'next/server'
import { updateTask } from '@lib/tracking_db'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const id = body.id || body.task_id
  const status = body.status
  const priority = body.priority
  if (!id) return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })
  const patch: any = {}
  if (status) patch.status = status
  if (priority) patch.priority = priority
  const task = await updateTask(String(id), patch)
  if (!task) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  return NextResponse.json({ task })
}

