import { NextRequest, NextResponse } from 'next/server'
import { listOrgCategoryRules, createOrgCategoryRule, deleteOrgCategoryRule, isSuperAdmin } from '@lib/db'
import { authenticatePublicApi, hasScope } from '@lib/public/auth'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') || searchParams.get('orgId')
  if (!orgId) return NextResponse.json({ error: 'MISSING_ORG' }, { status: 400 })
  const items = await listOrgCategoryRules(orgId)
  return NextResponse.json({ items })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { orgId, categoryKey, productivityStatus, displayName } = body
  if (!orgId || !categoryKey || !productivityStatus) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  
  const result = await createOrgCategoryRule({ orgId, categoryKey, productivityStatus, displayName })
  if (result === 'DUPLICATE') return NextResponse.json({ error: 'DUPLICATE' }, { status: 409 })
  if (result === 'DB_ERROR') return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  
  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('org_id') || searchParams.get('orgId')
  const id = searchParams.get('id')
  if (!orgId || !id) return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  
  const result = await deleteOrgCategoryRule(orgId, id)
  if (result === 'NOT_FOUND') return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (result === 'DB_ERROR') return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  
  return NextResponse.json({ status: 'OK' })
}
