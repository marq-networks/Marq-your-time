import { NextRequest, NextResponse } from 'next/server'
import { listRoles, createRole } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('orgId')
  if (!orgId) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  
  let items = await listRoles(orgId)

  // Auto-seed default roles if none exist
  if (items.length === 0) {
    const allPerms = ['manage_org','manage_users','manage_time','manage_screenshots','manage_salary','manage_fines','manage_reports','manage_settings'] as any[]
    
    await Promise.all([
      createRole({ orgId, name: 'Owner', permissions: allPerms }),
      createRole({ orgId, name: 'Admin', permissions: allPerms }),
      createRole({ orgId, name: 'Employee', permissions: [] })
    ])
    
    items = await listRoles(orgId)
  }

  return NextResponse.json({ items })
}

