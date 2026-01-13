import { NextRequest, NextResponse } from 'next/server'
import { createProject } from '@lib/tracking_db'

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.org_id || !body.name) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const project = await createProject({
    orgId: body.org_id,
    clientId: body.client_id,
    name: body.name,
    code: body.code,
    description: body.description,
    status: body.status || 'active',
    budgetType: body.budget_type,
    budgetValue: body.budget_value,
    startDate: body.start_date,
    endDate: body.end_date,
    managerId: body.manager_id,
    isBillable: body.is_billable
  })
  if (!project) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json(project)
}