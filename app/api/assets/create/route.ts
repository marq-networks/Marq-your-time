import { NextRequest, NextResponse } from 'next/server'
import { createAsset } from '@lib/db'

function allow(role: string) { return ['admin','owner','it','super_admin'].includes(role) }

export async function POST(req: NextRequest) {
  const role = (req.headers.get('x-role') || '').toLowerCase()
  if (!allow(role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const body = await req.json()
  const org_id = body.org_id || body.orgId || ''
  const asset_tag = body.asset_tag || body.assetTag || ''
  const category = (body.category || '').toLowerCase()
  const status = (body.status || '').toLowerCase()
  if (!org_id || !asset_tag || !category || !status) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  const res = await createAsset({ orgId: org_id, assetTag: asset_tag, category, model: body.model || undefined, serialNumber: body.serial_number || body.serialNumber || undefined, purchaseDate: body.purchase_date || body.purchaseDate || undefined, warrantyEnd: body.warranty_end || body.warrantyEnd || undefined, status })
  if (typeof res === 'string') return NextResponse.json({ error: res }, { status: 400 })
  return NextResponse.json({ item: res })
}

