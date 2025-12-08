import { NextRequest, NextResponse } from 'next/server'
import { listAssetsWithActiveAssignment } from '@lib/db'

export async function GET(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const { searchParams } = new URL(req.url)
  const org_id = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const status = (searchParams.get('status') || '').toLowerCase() as any
  const category = (searchParams.get('category') || '').toLowerCase() as any
  if (!org_id) return NextResponse.json({ items: [] })
  const rows = await listAssetsWithActiveAssignment({ orgId: org_id, status: status || undefined, category: category || undefined })
  const items = rows.map(r => ({ id: r.asset.id, org_id: r.asset.orgId, asset_tag: r.asset.assetTag, category: r.asset.category, model: r.asset.model || null, status: r.asset.status, assigned_to: r.assignedTo || null }))
  return NextResponse.json({ items })
}
