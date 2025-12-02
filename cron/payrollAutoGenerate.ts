import { listOrganizations } from '@lib/db'
import { createPeriod, generateForPeriod } from '@lib/payroll/store'

export async function runPayrollAutoGenerate() {
  const orgs = await listOrganizations()
  const today = new Date()
  const ym = today.toISOString().slice(0,7)
  for (const org of orgs) {
    const start = new Date(`${ym}-01`).toISOString().slice(0,10)
    const end = new Date(new Date(`${ym}-01T00:00:00Z`).setMonth(new Date(`${ym}-01T00:00:00Z`).getMonth()+1)-1).toISOString().slice(0,10)
    const period = await createPeriod({ org_id: org.id, period_start: start, period_end: end, created_by: 'system-cron' }) as any
    await generateForPeriod(period.id, org.id)
  }
}

