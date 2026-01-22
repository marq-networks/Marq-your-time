"use client"
import { useEffect, useMemo, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import GlassTable from '@components/ui/GlassTable'
import ExportMenu from '@components/shared/ExportMenu'
import { ExportColumn, exportToCsv, exportToPdf } from '@lib/export-utils'
import { useListQuery } from '@/lib/hooks/useListQuery'
import { normalizeRoleForApi } from '@/lib/permissions'
import FilterBar from '@/components/filters/FilterBar'
import DateRangePicker from '@/components/filters/DateRangePicker'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string, departmentId?: string }
type Department = { id: string, name: string }
type MemberRole = { id: string, name: string, level: number }

function dateISO(d: Date) { return d.toISOString().slice(0,10) }
function rangeQuick(key: '7'|'30') { const end = new Date(); const start = new Date(end.getTime() - (key==='7'? 6:29)*24*60*60*1000); return { start: dateISO(start), end: dateISO(end) } }

export default function ReportsPage() {
  const { filters, setFilters } = useListQuery()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [deps, setDeps] = useState<Department[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<MemberRole[]>([])
  const [orgId, setOrgId] = useState('')
  const [reportType, setReportType] = useState<'attendance'|'timesheet'|'activity'|'payroll'|'billing'|'leave'>('attendance')
  const [format, setFormat] = useState<'csv'|'xlsx'|'pdf'>('csv')
  const [runAsync, setRunAsync] = useState(false)
  const [rows, setRows] = useState<string[][]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [downloading, setDownloading] = useState(false)
  const [templates, setTemplates] = useState<any>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const role = typeof document !== 'undefined' ? normalizeRoleForApi(document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''

  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      const exportItems = (jobs || []).map(j => ({
        created: new Date(j.created_at).toLocaleString(),
        type: j.report_type,
        status: j.status,
        params: JSON.stringify(j.params),
        url: j.file_url || ''
      }))
      const exportColumns: ExportColumn[] = [
        { header: 'Created', accessor: 'created' },
        { header: 'Type', accessor: 'type' },
        { header: 'Status', accessor: 'status' },
        { header: 'Params', accessor: 'params' },
        { header: 'Download URL', accessor: 'url' },
      ]
      const filename = `report_jobs_${new Date().toISOString().split('T')[0]}`
      if (type === 'csv') await exportToCsv(exportItems, exportColumns, filename)
      else await exportToPdf(exportItems, exportColumns, 'Report Jobs', filename)
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

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
    const start = filters.from || rangeQuick('7').start
    const end = filters.to || rangeQuick('7').end
    const payload: any = { org_id: orgId, report_type: reportType, format, params: { date_start: start, date_end: end, include_inactive: false }, async: runAsync }
    if (filters.memberId) payload.params.member_ids = [filters.memberId]
    if (filters.departmentId) payload.params.department_ids = [filters.departmentId]
    if (filters.status && (reportType==='leave' || reportType==='billing' || reportType==='payroll')) payload.params.status = filters.status
    if (filters.managerId) payload.params.manager_id = filters.managerId
    if (filters.memberRoleId) payload.params.member_role_ids = [filters.memberRoleId]
    const res = await fetch('/api/reports/generate', { method:'POST', headers:{ 'Content-Type':'application/json','x-role': role || 'admin' }, body: JSON.stringify(payload) })
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

  const loadJobs = async () => { if (!orgId) return; const r = await fetch(`/api/reports/jobs?org_id=${orgId}&limit=20`, { cache:'no-store', headers:{ 'x-role': role || 'admin' } }); const d = await r.json(); setJobs(d.items||[]) }

  const filterConfig = useMemo(() => [
    { key: 'departmentId', label: 'Department', type: 'select' as const, options: deps.map(d=>({label:d.name, value:d.id})) },
    { key: 'memberId', label: 'Member', type: 'select' as const, options: users.map(u=>({label:`${u.firstName} ${u.lastName}`, value:u.id})) },
    { key: 'memberRoleId', label: 'Role', type: 'select' as const, options: roles.map(r=>({label:r.name, value:r.id})) },
    { key: 'status', label: 'Status', type: 'select' as const, options: [{label:'Active', value:'active'}, {label:'Inactive', value:'inactive'}] },
    { key: 'date', label: 'Date Range', type: 'date-range' as const }
  ], [deps, users, roles])

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
          
          <div style={{ marginTop: 20 }}>
            <FilterBar pageKey="reports" orgId={orgId} config={filterConfig} showSavedViews />
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

        <GlassCard title="Job History" right={<ExportMenu onExport={handleExport} isExporting={isExporting} />}>
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
