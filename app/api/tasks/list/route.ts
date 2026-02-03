import { NextRequest, NextResponse } from 'next/server'
import { listTasks, listOrgTasks } from '@lib/tracking_db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')
  const orgId = searchParams.get('org_id')

  if (projectId) {
      const items = await listTasks(projectId)
      return NextResponse.json({ items })
  }
  
  if (orgId) {
      const items = await listOrgTasks(orgId)
      return NextResponse.json({ items })
  }

  return NextResponse.json({ error: 'MISSING_PROJECT_ID_OR_ORG_ID' }, { status: 400 })
}