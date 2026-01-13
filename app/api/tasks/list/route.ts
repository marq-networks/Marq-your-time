import { NextRequest, NextResponse } from 'next/server'
import { listTasks } from '@lib/tracking_db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')
  if (!projectId) return NextResponse.json({ error: 'MISSING_PROJECT_ID' }, { status: 400 })
  const items = await listTasks(projectId)
  return NextResponse.json({ items })
}