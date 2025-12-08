import { NextRequest, NextResponse } from 'next/server'
import { listMemberAssets } from '@lib/db'

export async function GET(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  const actor = req.headers.get('x-user-id') || ''
  const { searchParams } = new URL(req.url)
  const member_id = searchParams.get('member_id') || searchParams.get('memberId') || ''
  if (!member_id) return NextResponse.json({ items: [] })
  const allowedRoles = ['admin','owner','it','super_admin']
  if (!(allowedRoles.includes(role) || actor === member_id)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const items = await listMemberAssets(member_id)
  const mapped = items.map(x => ({
    assignment_id: x.assignment.id,
    asset_id: x.asset.id,
    asset_tag: x.asset.assetTag,
    category: x.asset.category,
    model: x.asset.model || null,
    assigned_at: new Date(x.assignment.assignedAt).toISOString(),
  }))
  return NextResponse.json({ items: mapped })
}

