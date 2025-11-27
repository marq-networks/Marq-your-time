import { NextResponse } from 'next/server'
import { listOrganizations } from '@lib/db'

export async function GET() {
  const items = await listOrganizations()
  return NextResponse.json({ items })
}
