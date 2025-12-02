import { NextRequest } from 'next/server'
import { listMemberRows } from '@lib/payroll/store'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const payroll_period_id = searchParams.get('payroll_period_id') || ''
  const format = (searchParams.get('format') || 'csv').toLowerCase()
  if (!payroll_period_id) return new Response(JSON.stringify({ error: 'MISSING_FIELDS' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  const items = await listMemberRows(payroll_period_id)
  if (format === 'csv' || format === 'xlsx') {
    const columns = ['Member','Base Salary','Worked Minutes','Extra Minutes','Short Minutes','Overtime','Short Deduction','Fines','Adjustments','Net Salary']
    const lines = [columns.join(',')].concat(items.map(r => [ r.member_id, r.base_salary, r.worked_minutes, r.extra_minutes, r.short_minutes, r.overtime_amount, r.short_deduction, r.fines_total, r.adjustments_total, r.net_salary ].join(',')))
    const content = lines.join('\n')
    const filename = `payroll_${payroll_period_id}.${format}`
    return new Response(content, { status: 200, headers: { 'Content-Type': format === 'csv' ? 'text/csv' : 'application/vnd.ms-excel', 'Content-Disposition': `attachment; filename=${filename}` } })
  }
  if (format === 'pdf') {
    const rows = items.map(r => `<tr><td>${r.member_id}</td><td>${r.base_salary}</td><td>${r.worked_minutes}</td><td>${r.extra_minutes}</td><td>${r.short_minutes}</td><td>${r.overtime_amount}</td><td>${r.short_deduction}</td><td>${r.fines_total}</td><td>${r.adjustments_total}</td><td>${r.net_salary}</td></tr>`).join('')
    const html = `<!doctype html><html><head><meta charset='utf-8'><title>Payroll Export</title></head><body><h2>Payroll Export</h2><table border='1' cellpadding='6'><thead><tr><th>Member</th><th>Base Salary</th><th>Worked Minutes</th><th>Extra Minutes</th><th>Short Minutes</th><th>Overtime</th><th>Short Deduction</th><th>Fines</th><th>Adjustments</th><th>Net Salary</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } })
  }
  return new Response(JSON.stringify({ error: 'UNSUPPORTED_FORMAT' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
}

