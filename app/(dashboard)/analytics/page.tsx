"use client"
import { useEffect, useMemo, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'
import usePermission from '@lib/hooks/usePermission'
import { normalizeRoleForApi } from '@lib/permissions'

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
      <rect x={0} y={0} width={width} height={height} fill="rgba(255,255,255,0.12)" rx={18} />
      <path d={d} stroke={color} strokeWidth={2.5} fill="none" />
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
      <rect x={0} y={0} width={width} height={height} fill="rgba(255,255,255,0.12)" rx={18} />
      <path d={dA} stroke={colorA} strokeWidth={2.5} fill="none" />
      <path d={dB} stroke={colorB} strokeWidth={2.5} fill="none" />
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

  const loadOrgs = async () => {
    const res = await fetch('/api/org/list', { cache:'no-store' })
    const d = await res.json()
    setOrgs(d.items || [])
    if (!orgId && d.items?.length) setOrgId(d.items[0].id)
  }
  const loadDeps = async (oid: string) => {
    const res = await fetch(`/api/department/list?orgId=${oid}`, { cache:'no-store' })
    const d = await res.json()
    setDepartments(d.items || [])
  }
  const refresh = async () => {
    if (!orgId) return
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
  }

  useEffect(() => { try { const r = normalizeRoleForApi((typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : '')); setRole(r) } catch {} }, [])
  useEffect(() => {
    try {
      const cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
      if (!orgId && cookieOrgId) setOrgId(cookieOrgId)
    } catch {}
  }, [])
  useEffect(() => { loadOrgs() }, [])
  useEffect(() => { if (orgId) loadDeps(orgId) }, [orgId])
  useEffect(() => { refresh() }, [orgId, start, end, departmentId, sortKey])

  const workedHM = useMemo(() => {
    const m = Math.round(overview?.time?.totalWorkedMinutes || 0)
    const h = Math.floor(m/60)
    const mm = String(m%60).padStart(2,'0')
    return `${h}:${mm}`
  }, [overview])

  if (!canView) {
    return (
      <AppShell title="Analytics">
        <div style={{display:'grid',placeItems:'center',height:'60vh'}}>
          <div className="glass-panel" style={{padding:24,borderRadius:'var(--radius-large)'}}>
            <div className="title">No Access</div>
            <div className="subtitle">You do not have permission to view analytics.</div>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Analytics">
      <GlassCard title="Filters" right={(
        <div className="row">
          <GlassButton variant="primary" onClick={()=>{ const r = rangeFromQuick('7'); setStart(r.start); setEnd(r.end) }} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Last 7 days</GlassButton>
          <GlassButton variant="primary" onClick={()=>{ const r = rangeFromQuick('30'); setStart(r.start); setEnd(r.end) }} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Last 30 days</GlassButton>
          <GlassButton variant="primary" onClick={()=>{ const r = rangeFromQuick('90'); setStart(r.start); setEnd(r.end) }} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Last 90 days</GlassButton>
          <GlassButton variant="primary" onClick={()=>{ const r = rangeFromQuick('month'); setStart(r.start); setEnd(r.end) }} style={{ background:'#39FF14', borderColor:'#39FF14' }}>This month</GlassButton>
        </div>
      )}>
        <div className="grid-1">
          <div>
            <div className="label">Organization</div>
            {(['employee','member'].includes(role)) ? (
              <span className="tag-pill">{orgs.find(o=>o.id===orgId)?.orgName || orgs[0]?.orgName || ''}</span>
            ) : (
              <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
                <option value="">Select org</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.orgName}</option>)}
              </GlassSelect>
            )}
          </div>
          <div>
            <div className="label">Department</div>
            <GlassSelect value={departmentId} onChange={(e:any)=>setDepartmentId(e.target.value)}>
              <option value="">All</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">Date Range</div>
            <div className="row" style={{gap:10}}>
              <input className="input" type="date" value={start} onChange={e=>setStart(e.target.value)} />
              <input className="input" type="date" value={end} onChange={e=>setEnd(e.target.value)} />
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="grid-1 mt-5">
        <GlassCard title="Time & Attendance">
          <div className="row" style={{gap:18}}>
            <div>
              <div className="title">Worked</div>
              <div className="subtitle">{workedHM}</div>
            </div>
            <div>
              <div className="title">Scheduled</div>
              <div className="subtitle">{Math.round((overview?.time?.totalScheduledMinutes||0)/60)}h</div>
            </div>
            <div>
              <div className="title">Attendance</div>
              <div className="subtitle">{overview?.time?.attendanceRatePercent || 0}%</div>
            </div>
          </div>
          <LineChart points={timeSeries} color="#0f6a50" />
        </GlassCard>
        <GlassCard title="Productivity">
          <div className="row" style={{gap:24}}>
            <div>
              <div className="title">Active</div>
              <div className="subtitle">{overview?.productivity?.activeMinutes || 0}</div>
            </div>
            <div>
              <div className="title">Productive</div>
              <div className="subtitle">{overview?.productivity?.productiveMinutes || 0}</div>
            </div>
            <div>
              <div className="title">Unproductive</div>
              <div className="subtitle">{overview?.productivity?.unproductiveMinutes || 0}</div>
            </div>
            <div>
              <div className="title">Idle</div>
              <div className="subtitle">{overview?.productivity?.idleMinutes || 0}</div>
            </div>
          </div>
          <div className="row" style={{gap:12}}>
            {(overview?.productivity?.topApps||[]).slice(0,6).map((a: any) => (
              <span key={a.app} className="tag-pill accent">{a.app} • {a.count}</span>
            ))}
          </div>
        </GlassCard>
        <GlassCard title="Payroll">
          <div className="row" style={{gap:20}}>
            <div>
              <div className="title">Net</div>
              <div className="subtitle">${Math.round(overview?.cost?.totalPayrollNet || 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="title">Base</div>
              <div className="subtitle">${Math.round(overview?.cost?.totalBase || 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="title">Overtime</div>
              <div className="subtitle">${Math.round(overview?.cost?.totalOvertime || 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="title">Deductions</div>
              <div className="subtitle">${Math.round(overview?.cost?.totalDeductions || 0).toLocaleString()}</div>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid-1 mt-5">
        <GlassCard title="Department Performance">
          <div style={{ overflowX:'auto' }}>
          <GlassTable
            columns={["Department","Members","Worked Hours","Extra Hours","Productivity Score"]}
            rows={deptPerf.map(d => [
              d.department_name,
              String(d.members_count||0),
              String(Math.round((d.worked_minutes||0)/60)),
              String(Math.round((d.extra_minutes||0)/60)),
              `${Math.round(d.productivity_score||0)}%`
            ])}
          />
          </div>
        </GlassCard>
        <GlassCard title="Cost vs Hours">
          <DualLineChart points={costHours.map(p => ({ date: p.date, a: Math.round(p.totalWorkedMinutes||0), b: Math.round(p.payrollCost||0) }))} colorA="#0f6a50" colorB="#e67e22" />
        </GlassCard>
      </div>

      <GlassCard title="Member Leaderboard" right={(
        <div className="row mt-5">
          <GlassSelect value={sortKey} onChange={(e:any)=>setSortKey(e.target.value)}>
            <option value="worked">Worked</option>
            <option value="extra">Extra</option>
            <option value="short">Short</option>
            <option value="productivity">Productivity</option>
            <option value="net_pay">Net pay</option>
          </GlassSelect>
        </div>
      )}>
        <div style={{ overflowX:'auto' }}>
        <GlassTable
          columns={["Name","Dept","Worked","Extra","Short","Productivity","Net pay"]}
          rows={members.map(m => [
            m.name,
            m.dept,
            String(Math.round((m.worked_minutes||0)/60)),
            String(Math.round((m.extra_minutes||0)/60)),
            String(Math.round((m.short_minutes||0)/60)),
            `${Math.round(m.productivity||0)}%`,
            `$${Math.round(m.net_pay||0).toLocaleString()}`
          ])}
        />
        </div>
      </GlassCard>
    </AppShell>
  )
}
