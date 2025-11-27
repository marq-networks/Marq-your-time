import { NextRequest, NextResponse } from 'next/server'
import { getOrganization, listInvites } from '@lib/db'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const org = await getOrganization(params.id)
  if (!org) return NextResponse.json({ error: 'ORG_NOT_FOUND' }, { status: 404 })
  const invites = await listInvites(params.id)
  return NextResponse.json({ org, invites })
}
