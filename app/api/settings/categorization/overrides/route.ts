import { NextRequest, NextResponse } from 'next/server'
import { listOrgUrlOverrides, createOrgUrlOverride, deleteOrgUrlOverride } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') || searchParams.get('orgId')
  if (!orgId) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  const items = await listOrgUrlOverrides(orgId)
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { orgId, urlPattern, categoryKey } = body
  if (!orgId || !urlPattern || !categoryKey) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  
  const result = await createOrgUrlOverride({ orgId, urlPattern, categoryKey })
  if (result === 'DUPLICATE') return NextResponse.json({ error: 'DUPLICATE' }, { status: 409 })
  if (result === 'DB_ERROR') return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  
  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') || searchParams.get('orgId')
  const id = searchParams.get('id')
  if (!orgId || !id) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  
  const result = await deleteOrgUrlOverride(orgId, id)
  if (result === 'NOT_FOUND') return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (result === 'DB_ERROR') return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  
  return NextResponse.json({ status: 'OK' })
}
