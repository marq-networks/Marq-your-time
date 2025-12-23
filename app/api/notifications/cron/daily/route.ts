import { NextRequest, NextResponse } from 'next/server'
import { listOrganizations, listAllOrgMembers, applyShiftRulesToDay } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || (()=>{ const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10) })()
  const orgs = await listOrganizations()
  for (const org of orgs) {
    const members = await listAllOrgMembers(org.id)
    for (const m of members) {
      await applyShiftRulesToDay(m.id, org.id, date)
    }
  }
  return NextResponse.json({ status: 'OK', date })
}
