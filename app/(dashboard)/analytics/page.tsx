"use client"
import { useEffect, useMemo, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import ExportMenu from '@components/shared/ExportMenu'
import { ExportColumn, exportToCsv, exportToPdf } from '@lib/export-utils'
import GlassSelect from '@components/ui/GlassSelect'
import usePermission from '@lib/hooks/usePermission'
import { normalizeRoleForApi } from '@lib/permissions'
import { BarChart3, Clock, TrendingUp, DollarSign, Users, Filter, Calendar } from 'lucide-react'

type Org = { id: string, orgName: string }
type Department = { id: string, name: string }

function dateISO(d: Date) { return d.toISOString().slice(0,10) }
function addDays(base: string, days: number) { const dt = new Date(base + 'T00:00:00'); dt.setDate(dt.getDate() + days); return dateISO(dt) }
function rangeFromQuick(key: string) {
  const today = dateISO(new Date())
  if (key === '7') return { start: addDays(today, -6), end: today }
  if (key === '30') return { start: addDays(today, -29), end: today }
  if (key === '90') return { start: addDays(today, -89), end: today }
  if (key === 'month') { const d = new Date(); const start = new Date(d.getFullYear(), d.getMonth(), 1); const end = new Date(d.getFullYear(), d.getMonth()+1, 0); return { start: dateISO(start), end: dateISO(end) } }
  return { start: today, end: today }
}

function LineChart({ points, color }: { points: { date: string, value: number }[], color: string }) {
  const width = 600, height = 160, pad = 24
  const vals = points.map(p => p.value)
  const max = Math.max(1, ...vals)
  const xs = points.map((_, i) => pad + (i * (width - pad*2) / Math.max(1, points.length - 1)))
  const ys = points.map(p => height - pad - (p.value / max) * (height - pad*2))
  const d = points.length ? `M ${xs[0]},${ys[0]} ` + xs.slice(1).map((x,i) => `L ${x},${ys[i+1]}`).join(' ') : ''
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ display:'block', width:'100%' }}>
      <rect x={0} y={0} width={width} height={height} fill="var(--color-bg-secondary, #f9fafb)" rx={12} />
      <path d={d} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DualLineChart({ points, colorA, colorB }: { points: { date: string, a: number, b: number }[], colorA: string, colorB: string }) {
  const width = 600, height = 160, pad = 24
  const max = Math.max(1, ...points.flatMap(p => [p.a, p.b]))
  const xs = points.map((_, i) => pad + (i * (width - pad*2) / Math.max(1, points.length - 1)))
  const yv = (v: number) => height - pad - (v / max) * (height - pad*2)
  const dA = points.length ? `M ${xs[0]},${yv(points[0].a)} ` + xs.slice(1).map((x,i) => `L ${x},${yv(points[i+1].a)}`).join(' ') : ''
  const dB = points.length ? `M ${xs[0]},${yv(points[0].b)} ` + xs.slice(1).map((x,i) => `L ${x},${yv(points[i+1].b)}`).join(' ') : ''
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ display:'block', width:'100%' }}>
      <rect x={0} y={0} width={width} height={height} fill="var(--color-bg-secondary, #f9fafb)" rx={12} />
      <path d={dA} stroke={colorA} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={dB} stroke={colorB} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function AnalyticsPage() {
  const canView = usePermission('manage_reports').allowed
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [role, setRole] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentId, setDepartmentId] = useState('')
  const [start, setStart] = useState(rangeFromQuick('7').start)
  const [end, setEnd] = useState(rangeFromQuick('7').end)
  const [overview, setOverview] = useState<any>(null)
  const [timeSeries, setTimeSeries] = useState<{ date: string, value: number }[]>([])
  const [deptPerf, setDeptPerf] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [costHours, setCostHours] = useState<{ date: string, totalWorkedMinutes: number, payrollCost: number }[]>([])
  const [sortKey, setSortKey] = useState('worked')
  const [isExporting, setIsExporting] = useState(false)

  const handleExportDepartments = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      const exportItems = deptPerf.map(d => ({
        name: d.department_name,
        members: d.members_count || 0,
        worked: Math.round((d.worked_minutes || 0) / 60),
        extra: Math.round((d.extra_minutes || 0) / 60),
        productivity: `${Math.round(d.productivity_score || 0)}%`
      }))

      const columns: ExportColumn[] = [
        { header: 'Department', accessor: 'name' },
        { header: 'Members', accessor: 'members' },
        { header: 'Worked Hours', accessor: 'worked' },
        { header: 'Extra Hours', accessor: 'extra' },
        { header: 'Productivity Score', accessor: 'productivity' }
      ]

      const filename = `marq_analytics_departments_${new Date().toISOString().split('T')[0]}`
      if (type === 'csv') await exportToCsv(exportItems, columns, filename)
      else await exportToPdf(exportItems, columns, 'Department Performance', filename)
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportMembers = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      const exportItems = members.map(m => ({
        name: m.name,
        dept: m.dept,
        worked: Math.round((m.worked_minutes || 0) / 60),
        extra: Math.round((m.extra_minutes || 0) / 60),
        short: Math.round((m.short_minutes || 0) / 60),
        productivity: `${Math.round(m.productivity || 0)}%`,
        net_pay: `$${Math.round(m.net_pay || 0).toLocaleString()}`
      }))

      const columns: ExportColumn[] = [
        { header: 'Name', accessor: 'name' },
        { header: 'Dept', accessor: 'dept' },
        { header: 'Worked', accessor: 'worked' },
        { header: 'Extra', accessor: 'extra' },
        { header: 'Short', accessor: 'short' },
        { header: 'Productivity', accessor: 'productivity' },
        { header: 'Net Pay', accessor: 'net_pay' }
      ]

      const filename = `marq_analytics_members_${new Date().toISOString().split('T')[0]}`
      if (type === 'csv') await exportToCsv(exportItems, columns, filename)
      else await exportToPdf(exportItems, columns, 'Member Leaderboard', filename)
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const loadOrgs = async () => {
    const endpoint = role === 'super_admin' ? '/api/org/list' : '/api/orgs/my'
    const res = await fetch(endpoint, { cache:'no-store' })
    const d = await res.json()
    const items = d.items || []
    setOrgs(items)
    if (!orgId && items.length) {
       // Prefer cookie org if available and in the list
       const cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
       let preferred = items.find((o: Org) => o.id === cookieOrgId)?.id
       if (!preferred) {
         // Heuristic: Avoid 'marqnetworks' (often empty seed org) if others exist
         const better = items.find((o: Org) => o.orgName !== 'marqnetworks')
         preferred = better ? better.id : items[0].id
       }
       setOrgId(preferred)
    }
  }
  const loadDeps = async (oid: string) => {
    const res = await fetch(`/api/department/list?orgId=${oid}`, { cache:'no-store' })
    const d = await res.json()
    setDepartments(d.items || [])
  }
  const refresh = async () => {
    if (!orgId) return
    try {
      const dep = departmentId ? `&department=${departmentId}` : ''
      const ovRes = await fetch(`/api/analytics/org-overview?org_id=${orgId}&start=${start}&end=${end}${dep}`, { cache:'no-store' })
      const ov = await ovRes.json()
      setOverview(ov)
      const tsRes = await fetch(`/api/analytics/time-series?org_id=${orgId}&metric=worked&start=${start}&end=${end}`, { cache:'no-store' })
      const ts = await tsRes.json()
      setTimeSeries(ts.points || [])
      const dpRes = await fetch(`/api/analytics/departments?org_id=${orgId}&start=${start}&end=${end}`, { cache:'no-store' })
      const dp = await dpRes.json()
      setDeptPerf(dp.items || [])
      const memRes = await fetch(`/api/analytics/members-leaderboard?org_id=${orgId}&start=${start}&end=${end}&sort=${sortKey}${dep}`, { cache:'no-store' })
      const mem = await memRes.json()
      setMembers(mem.items || [])
      const chRes = await fetch(`/api/analytics/cost-vs-hours?org_id=${orgId}&start=${start}&end=${end}`, { cache:'no-store' })
      const ch = await chRes.json()
      setCostHours(ch.points || [])
    } catch (e) {
      console.error("Failed to load analytics data", e)
    }
  }

  useEffect(() => { try { const r = normalizeRoleForApi((typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : '')); setRole(r) } catch {} }, [])
  useEffect(() => {
    try {
      const cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
      if (!orgId && cookieOrgId) setOrgId(cookieOrgId)
    } catch {}
  }, [])
  useEffect(() => { loadOrgs() }, [role])
  useEffect(() => { if (orgId) loadDeps(orgId) }, [orgId])
  useEffect(() => { refresh() }, [orgId, start, end, departmentId, sortKey])

  const workedHM = useMemo(() => {
    const m = Math.round(overview?.time?.totalWorkedMinutes || 0)
    const h = Math.floor(m/60)
    const mm = String(m%60).padStart(2,'0')
    return `${h}:${mm}`
  }, [overview])

  const isDataEmpty = useMemo(() => {
    if (!overview) return false
    const t = overview.time || {}
    const p = overview.productivity || {}
    const c = overview.cost || {}
    return (t.totalWorkedMinutes === 0 && p.activeMinutes === 0 && c.totalPayrollNet === 0)
  }, [overview])

  if (!canView) {
    return (
      <AppShell title="Analytics">
        <div className="flex justify-center items-center h-[60vh]">
          <div className="card p-8 rounded-xl text-center">
            <div className="text-xl font-bold mb-2">No Access</div>
            <div className="text-muted-foreground">You do not have permission to view analytics.</div>
          </div>
        </div>
      </AppShell>
    )
  }

  const dateBtnClass = (range: string) => `
    px-3 py-1.5 rounded-md text-xs font-semibold transition-all
    ${start === rangeFromQuick(range).start ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:bg-gray-200/50'}
  `

  return (
    <AppShell title="Analytics">
      <div className="mb-6">
        <GlassCard>
          <div className="flex justify-between items-center flex-wrap gap-5">
            <div className="flex items-center gap-3">
              <Filter size={20} className="text-muted-foreground" />
              <div className="font-semibold">Filters</div>
            </div>
            <div className="flex gap-4 flex-wrap items-center">
              {(['employee','member'].includes(role)) ? (
                <span className="tag-pill">{orgs.find(o=>o.id===orgId)?.orgName || orgs[0]?.orgName || ''}</span>
              ) : (
                <div className="w-48">
                  <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
                    <option value="">Select org</option>
                    {orgs.map(o => <option key={o.id} value={o.id}>{o.orgName}</option>)}
                  </GlassSelect>
                </div>
              )}
              <div className="w-48">
                <GlassSelect value={departmentId} onChange={(e:any)=>setDepartmentId(e.target.value)}>
                  <option value="">All Departments</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </GlassSelect>
              </div>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <button onClick={()=>{ const r = rangeFromQuick('7'); setStart(r.start); setEnd(r.end) }} className={dateBtnClass('7')}>7D</button>
                <button onClick={()=>{ const r = rangeFromQuick('30'); setStart(r.start); setEnd(r.end) }} className={dateBtnClass('30')}>30D</button>
                <button onClick={()=>{ const r = rangeFromQuick('month'); setStart(r.start); setEnd(r.end) }} className={dateBtnClass('month')}>Month</button>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {isDataEmpty && (
        <div className="mb-6 p-4 rounded-xl border border-yellow-200 bg-yellow-50 text-yellow-800 text-sm flex items-center justify-between">
          <span>
            <strong>No data found.</strong> This organization appears to have no activity for the selected date range.
            {orgs.length > 1 && " Try switching organizations."}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-primary" />
            <span className="font-semibold text-lg">Time & Attendance</span>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Worked</div>
              <div className="text-2xl font-bold">{workedHM}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Scheduled</div>
              <div className="text-2xl font-bold">{Math.round((overview?.time?.totalScheduledMinutes||0)/60)}h</div>
            </div>
          </div>
          <div className="h-[100px]">
            <LineChart points={timeSeries} color="#3dd6a3" />
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-primary" />
            <span className="font-semibold text-lg">Productivity</span>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Productive</div>
              <div className="text-2xl font-bold text-green-500">{overview?.productivity?.productiveMinutes || 0}m</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Unproductive</div>
              <div className="text-2xl font-bold text-red-400">{overview?.productivity?.unproductiveMinutes || 0}m</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(overview?.productivity?.topApps||[]).slice(0,4).map((a: any) => (
              <span key={a.app} className="px-2 py-1 rounded bg-gray-100 text-xs font-medium text-gray-700">{a.app}</span>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={18} className="text-primary" />
            <span className="font-semibold text-lg">Payroll Estimates</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Net Pay</div>
              <div className="text-2xl font-bold">${Math.round(overview?.cost?.totalPayrollNet || 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase mb-1">Overtime</div>
              <div className="text-2xl font-bold">${Math.round(overview?.cost?.totalOvertime || 0).toLocaleString()}</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Base Pay</span>
              <span className="font-semibold">${Math.round(overview?.cost?.totalBase || 0).toLocaleString()}</span>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <GlassCard>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-primary" />
              <span className="font-semibold text-lg">Department Performance</span>
            </div>
            <ExportMenu onExport={handleExportDepartments} isExporting={isExporting} />
          </div>
          <div className="overflow-x-auto">
            <GlassTable
              columns={[
                { name: "Department", width: "150px" },
                { name: "Members", width: "100px" },
                { name: "Worked", width: "100px" },
                { name: "Extra", width: "100px" },
                { name: "Score", width: "80px" }
              ]}
              rows={deptPerf.map(d => [
                <span key="name" className="font-medium">{d.department_name}</span>,
                <span key="mem" className="text-muted-foreground">{String(d.members_count||0)}</span>,
                <span key="wrk">{Math.round((d.worked_minutes||0)/60)}h</span>,
                <span key="extra">{Math.round((d.extra_minutes||0)/60)}h</span>,
                <span key="score" className={d.productivity_score > 80 ? 'text-green-600 font-bold' : d.productivity_score > 50 ? 'text-yellow-600 font-bold' : 'text-red-500 font-bold'}>
                  {Math.round(d.productivity_score||0)}%
                </span>
              ])}
            />
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-primary" />
            <span className="font-semibold text-lg">Cost vs Hours</span>
          </div>
          <div className="h-[240px]">
            <DualLineChart points={costHours.map(p => ({ date: p.date, a: Math.round(p.totalWorkedMinutes||0), b: Math.round(p.payrollCost||0) }))} colorA="#3dd6a3" colorB="#6b7280" />
          </div>
          <div className="flex justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#3dd6a3]"></div> 
              <span>Worked Hours</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#6b7280]"></div> 
              <span>Payroll Cost</span>
            </div>
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-primary" />
            <span className="font-semibold text-lg">Member Leaderboard</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-[200px]">
              <GlassSelect value={sortKey} onChange={(e:any)=>setSortKey(e.target.value)}>
                <option value="worked">Sort by Worked</option>
                <option value="extra">Sort by Extra</option>
                <option value="short">Sort by Short</option>
                <option value="productivity">Sort by Productivity</option>
                <option value="net_pay">Sort by Net Pay</option>
              </GlassSelect>
            </div>
            <ExportMenu onExport={handleExportMembers} isExporting={isExporting} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <GlassTable
            columns={[
              { name: "Name", width: "200px" },
              { name: "Dept", width: "150px" },
              { name: "Worked", width: "100px" },
              { name: "Extra", width: "100px" },
              { name: "Short", width: "100px" },
              { name: "Productivity", width: "100px" },
              { name: "Net Pay", width: "120px" }
            ]}
            rows={members.map(m => [
              <div key="name" className="font-semibold">{m.name}</div>,
              <span key="dept" className="px-2 py-1 rounded bg-gray-100 text-xs font-medium text-gray-700">{m.dept}</span>,
              <span key="wrk">{Math.round((m.worked_minutes||0)/60)}h</span>,
              <span key="extra" className={m.extra_minutes > 0 ? 'text-yellow-600 font-medium' : 'text-muted-foreground'}>{Math.round((m.extra_minutes||0)/60)}h</span>,
              <span key="short" className={m.short_minutes > 0 ? 'text-red-500 font-medium' : 'text-muted-foreground'}>{Math.round((m.short_minutes||0)/60)}h</span>,
              <span key="prod" className="font-bold">{Math.round(m.productivity||0)}%</span>,
              <span key="pay" className="font-medium">${Math.round(m.net_pay||0).toLocaleString()}</span>
            ])}
          />
        </div>
      </GlassCard>
    </AppShell>
  )
}
