import { NextRequest } from 'next/server'
import { listMemberRows } from '@lib/payroll/store'
import { listUsers, listDepartments, listMemberRoles } from '@lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const payroll_period_id = searchParams.get('payroll_period_id') || ''
  const org_id = searchParams.get('org_id') || searchParams.get('orgId') || ''
  const format = (searchParams.get('format') || 'csv').toLowerCase()
  if (!payroll_period_id) return new Response(JSON.stringify({ error: 'MISSING_FIELDS' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  const items = await listMemberRows(payroll_period_id)
  let userMap: Map<string, any> | undefined
  let deptMap: Map<string, string> | undefined
  let roleMap: Map<string, { name: string, level: number }> | undefined
  if (org_id) {
    const users = await listUsers(org_id)
    const depts = await listDepartments(org_id)
    const roles = await listMemberRoles(org_id)
    userMap = new Map(users.map(u => [u.id, u]))
    deptMap = new Map(depts.map(d => [d.id, d.name]))
    roleMap = new Map(roles.map(r => [r.id, { name: r.name, level: Number(r.level||0) }]))
  }
  if (format === 'csv' || format === 'xlsx') {
    const columns = ['Member','Department','Member Role','Manager','Base Salary','Worked Minutes','Extra Minutes','Short Minutes','Overtime','Short Deduction','Fines','Adjustments','Net Salary']
    const lines = [columns.join(',')].concat(items.map(r => {
      const u = userMap?.get(String(r.member_id))
      const dept = u?.departmentId ? (deptMap?.get(String(u.departmentId)) || '') : ''
      const mr = u?.memberRoleId ? roleMap?.get(String(u.memberRoleId)) : undefined
      const mrLabel = mr ? `${mr.name} (L${mr.level})` : ''
      const mgr = u?.managerId ? (userMap?.get(String(u.managerId))?.email || u.managerId) : ''
      return [ r.member_id, dept, mrLabel, mgr, r.base_salary, r.worked_minutes, r.extra_minutes, r.short_minutes, r.overtime_amount, r.short_deduction, r.fines_total, r.adjustments_total, r.net_salary ].join(',')
    }))
    const content = lines.join('\n')
    const filename = `payroll_${payroll_period_id}.${format}`
    return new Response(content, { status: 200, headers: { 'Content-Type': format === 'csv' ? 'text/csv' : 'application/vnd.ms-excel', 'Content-Disposition': `attachment; filename=${filename}` } })
  }
  if (format === 'pdf') {
    const rows = items.map(r => {
      const u = userMap?.get(String(r.member_id))
      const dept = u?.departmentId ? (deptMap?.get(String(u.departmentId)) || '') : ''
      const mr = u?.memberRoleId ? roleMap?.get(String(u.memberRoleId)) : undefined
      const mrLabel = mr ? `${mr.name} (L${mr.level})` : ''
      const mgr = u?.managerId ? (userMap?.get(String(u.managerId))?.email || u.managerId) : ''
      return `<tr><td>${r.member_id}</td><td>${dept}</td><td>${mrLabel}</td><td>${mgr}</td><td>${r.base_salary}</td><td>${r.worked_minutes}</td><td>${r.extra_minutes}</td><td>${r.short_minutes}</td><td>${r.overtime_amount}</td><td>${r.short_deduction}</td><td>${r.fines_total}</td><td>${r.adjustments_total}</td><td>${r.net_salary}</td></tr>`
    }).join('')
    const html = `<!doctype html><html><head><meta charset='utf-8'><title>Payroll Export</title></head><body><h2>Payroll Export</h2><table border='1' cellpadding='6'><thead><tr><th>Member</th><th>Department</th><th>Member Role</th><th>Manager</th><th>Base Salary</th><th>Worked Minutes</th><th>Extra Minutes</th><th>Short Minutes</th><th>Overtime</th><th>Short Deduction</th><th>Fines</th><th>Adjustments</th><th>Net Salary</th></tr></thead><tbody>${rows}</tbody></table></body></html>`
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } })
  }
  return new Response(JSON.stringify({ error: 'UNSUPPORTED_FORMAT' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
}
