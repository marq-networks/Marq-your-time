"use client"
import { useEffect, useMemo, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import GlassTable from '@components/ui/GlassTable'
import GlassModal from '@components/ui/GlassModal'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string, departmentId?: string }
type Department = { id: string, name: string }
type MemberRole = { id: string, name: string, level: number }

function dateISO(d: Date) { return d.toISOString().slice(0,10) }
function rangeQuick(key: '7'|'30') { const end = new Date(); const start = new Date(end.getTime() - (key==='7'? 6:29)*24*60*60*1000); return { start: dateISO(start), end: dateISO(end) } }

export default function ReportsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [deps, setDeps] = useState<Department[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<MemberRole[]>([])
  const [orgId, setOrgId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [managerId, setManagerId] = useState('')
  const [memberRoleId, setMemberRoleId] = useState('')
  const [reportType, setReportType] = useState<'attendance'|'timesheet'|'activity'|'payroll'|'billing'|'leave'>('attendance')
  const [format, setFormat] = useState<'csv'|'xlsx'|'pdf'>('csv')
  const [status, setStatus] = useState<string>('')
  const [runAsync, setRunAsync] = useState(false)
  const [start, setStart] = useState<string>(rangeQuick('7').start)
  const [end, setEnd] = useState<string>(rangeQuick('7').end)
  const [rows, setRows] = useState<string[][]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [downloading, setDownloading] = useState(false)
  const [templates, setTemplates] = useState<any>(null)
  const [jobs, setJobs] = useState<any[]>([])

  const loadOrgs = async () => { const r = await fetch('/api/org/list', { cache:'no-store', headers:{ 'x-user-id':'admin' } }); const d = await r.json(); setOrgs(d.items||[]) }
  const loadDepsUsers = async (org: string) => {
    const dr = await fetch(`/api/department/list?orgId=${org}`, { cache:'no-store' }); const dd = await dr.json(); setDeps(dd.items||[])
    const ur = await fetch(`/api/user/list?orgId=${org}`, { cache:'no-store' }); const ud = await ur.json(); setUsers(ud.items||[])
    const rr = await fetch(`/api/org/roles?org_id=${org}`, { cache:'no-store' }); const rd = await rr.json(); setRoles(rd.items||[])
  }
  const loadTemplates = async () => { const r = await fetch('/api/reports/templates', { cache:'no-store' }); const d = await r.json(); setTemplates(d) }

  const desc = useMemo(()=> (templates?.reports||[]).find((r:any)=> r.type === reportType)?.fields?.join(', ') || '', [templates, reportType])

  const previewCSV = (csv: string) => {
    const lines = csv.split('\n').filter(Boolean)
    const cols = lines[0].split(',').map(s => s.replace(/^"|"$/g,''))
    const preview = lines.slice(1, Math.min(lines.length, 26)).map(l => l.split(',').map(s => s.replace(/^"|"$/g,'')))
    setColumns(cols)
    setRows(preview)
  }

  const generate = async () => {
    if (!orgId) return
    setDownloading(true)
    const payload: any = { org_id: orgId, report_type: reportType, format, params: { date_start: start, date_end: end, include_inactive: false }, async: runAsync }
    if (memberId) payload.params.member_ids = [memberId]
    if (departmentId) payload.params.department_ids = [departmentId]
    if (status && (reportType==='leave' || reportType==='billing' || reportType==='payroll')) payload.params.status = status
    if (managerId) payload.params.manager_id = managerId
    if (memberRoleId) payload.params.member_role_ids = [memberRoleId]
    const res = await fetch('/api/reports/generate', { method:'POST', headers:{ 'Content-Type':'application/json','x-role':'admin' }, body: JSON.stringify(payload) })
    if (res.ok && !runAsync) {
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('text/csv')) {
        const blob = await res.blob()
        const txt = await blob.text()
        previewCSV(txt)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${reportType}_${start}_${end}.csv`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        const d = await res.json()
        if (d.csv) previewCSV(d.csv)
      }
    } else if (res.ok && runAsync) {
      const d = await res.json()
      const jobId = d.job_id
      const poll = async () => {
        const jr = await fetch(`/api/reports/job-status?job_id=${jobId}`, { cache:'no-store' })
        const jd = await jr.json()
        if (jd.status === 'completed' && jd.file_url) {
          const a = document.createElement('a')
          a.href = jd.file_url
          a.download = `${reportType}_${start}_${end}.csv`
          a.click()
          await loadJobs()
        } else if (jd.status === 'error') {
          await loadJobs()
        } else {
          setTimeout(poll, 1500)
        }
      }
      setTimeout(poll, 1500)
    }
    setDownloading(false)
  }

  useEffect(()=>{ loadOrgs(); loadTemplates() }, [])
  useEffect(()=>{ if (orgId) { loadDepsUsers(orgId) } }, [orgId])
  useEffect(()=>{ if (orgId) { loadJobs() } else { setJobs([]) } }, [orgId])

  const loadJobs = async () => { if (!orgId) return; const r = await fetch(`/api/reports/jobs?org_id=${orgId}&limit=20`, { cache:'no-store', headers:{ 'x-role':'admin' } }); const d = await r.json(); setJobs(d.items||[]) }

  return (
    <AppShell title="Reports">
      <div style={{ backgroundImage:'linear-gradient(135deg, #d9c7b2, #e8ddce, #c9b8a4)', borderRadius:'var(--radius-large)', padding:12 }}>
        <GlassCard title="Report Type">
          <div className="grid-3">
            <div>
              <div className="label">Organization</div>
              <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
                <option value="">Select org</option>
                {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
              </GlassSelect>
            </div>
            <div>
              <div className="label">Report Type</div>
              <GlassSelect value={reportType} onChange={(e:any)=>setReportType(e.target.value)}>
                <option value="attendance">Attendance</option>
                <option value="timesheet">Timesheets</option>
                <option value="activity">Activity</option>
                <option value="payroll">Payroll</option>
                <option value="billing">Billing</option>
                <option value="leave">Leave</option>
              </GlassSelect>
              <div className="subtitle" style={{ marginTop: 6 }}>{desc}</div>
            </div>
            <div>
              <div className="label">Format</div>
              <GlassSelect value={format} onChange={(e:any)=>setFormat(e.target.value)}>
                <option value="csv">CSV</option>
                <option value="xlsx">XLSX</option>
                <option value="pdf">PDF</option>
              </GlassSelect>
            </div>
          </div>
        </GlassCard>

        <GlassCard title="Filters" right={<div className="row" style={{ gap:8 }}>
          <GlassButton variant="primary" onClick={()=>{ const r = rangeQuick('7'); setStart(r.start); setEnd(r.end) }} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Last 7 days</GlassButton>
          <GlassButton variant="primary" onClick={()=>{ const r = rangeQuick('30'); setStart(r.start); setEnd(r.end) }} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Last 30 days</GlassButton>
        </div>}>
          <div className="grid-3">
            <div>
              <div className="label">Date start</div>
              <input className="input" type="date" value={start} onChange={e=>setStart(e.target.value)} />
            </div>
            <div>
              <div className="label">Date end</div>
              <input className="input" type="date" value={end} onChange={e=>setEnd(e.target.value)} />
            </div>
            <div>
              <div className="label">Department</div>
              <GlassSelect value={departmentId} onChange={(e:any)=>setDepartmentId(e.target.value)}>
                <option value="">All</option>
                {deps.map(d=> <option key={d.id} value={d.id}>{d.name}</option>)}
              </GlassSelect>
            </div>
            <div>
              <div className="label">Member</div>
              <GlassSelect value={memberId} onChange={(e:any)=>setMemberId(e.target.value)}>
                <option value="">All</option>
                {users.map(u=> <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </GlassSelect>
            </div>
            <div>
              <div className="label">Manager</div>
              <GlassSelect value={managerId} onChange={(e:any)=>setManagerId(e.target.value)}>
                <option value="">All</option>
                {users.map(u=> <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </GlassSelect>
            </div>
            <div>
              <div className="label">Role</div>
              <GlassSelect value={memberRoleId} onChange={(e:any)=>setMemberRoleId(e.target.value)}>
                <option value="">All</option>
                {roles.map(r=> <option key={r.id} value={r.id}>{r.name} (L{r.level})</option>)}
              </GlassSelect>
            </div>
            {(reportType==='leave' || reportType==='billing' || reportType==='payroll') && (
              <div>
                <div className="label">Status</div>
                <GlassSelect value={status} onChange={(e:any)=>setStatus(e.target.value)}>
                  <option value="">All</option>
                  {reportType==='leave' && (<>
                    <option value="approved">approved</option>
                    <option value="pending">pending</option>
                    <option value="rejected">rejected</option>
                  </>)}
                  {reportType==='billing' && (<>
                    <option value="active">active</option>
                    <option value="trialing">trialing</option>
                    <option value="cancelled">cancelled</option>
                  </>)}
                  {reportType==='payroll' && (<>
                    <option value="open">open</option>
                    <option value="closed">closed</option>
                    <option value="processed">processed</option>
                  </>)}
                </GlassSelect>
              </div>
            )}
          </div>
          <div className="row" style={{ marginTop:12 }}>
            <GlassButton variant="primary" onClick={()=>{ if (!orgId || downloading) return; generate() }} style={{ background:'#39FF14', borderColor:'#39FF14' }}>{downloading? 'Generating...' : 'Generate & Download'}</GlassButton>
            <label className="row" style={{ gap:8, marginLeft:12 }}>
              <input type="checkbox" className="toggle" checked={runAsync} onChange={(e)=>setRunAsync(e.target.checked)} />
              <span className="label">Run async</span>
            </label>
          </div>
        </GlassCard>

        <GlassCard title="Preview">
          <GlassTable columns={columns} rows={rows} />
        </GlassCard>

        <GlassCard title="Job History">
          <GlassTable columns={[ 'Created', 'Type', 'Status', 'Params', 'Download' ]} rows={(jobs||[]).map(j=>[
            new Date(j.created_at).toLocaleString(),
            j.report_type,
            j.status,
            JSON.stringify(j.params),
            j.file_url ? <a href={j.file_url} download>Download</a> : ''
          ])} />
        </GlassCard>
      </div>
    </AppShell>
  )
}
