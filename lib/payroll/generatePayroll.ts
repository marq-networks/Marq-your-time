import { createPeriod, generateForPeriod } from './store'

export async function generatePayroll(input: { org_id: string, period_start?: string, period_end?: string, payroll_period_id?: string }) {
  if (input.payroll_period_id) return generateForPeriod(input.payroll_period_id, input.org_id)
  if (!input.period_start || !input.period_end) return 'MISSING_FIELDS'
  const p = await createPeriod({ org_id: input.org_id, period_start: input.period_start, period_end: input.period_end, created_by: 'system' })
  if (typeof p === 'string') return p
  return generateForPeriod((p as any).id, input.org_id)
}
