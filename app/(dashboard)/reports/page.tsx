'use client'
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
import { FileText, Download, Play, History, RefreshCw, Calendar, Users, Building, FileType, FileSpreadsheet, Clock, CreditCard, UserCheck, Coffee, Activity } from 'lucide-react'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string, departmentId?: string }
type Department = { id: string, name: string }
type MemberRole = { id: string, name: string, level: number }

function dateISO(d: Date) { return d.toISOString().slice(0,10) }
function rangeQuick(key: '7'|'30') { 
  const end = new Date(); 
  const start = new Date(end.getTime() - (key==='7'? 6:29)*24*60*60*1000); 
  return { start: dateISO(start), end: dateISO(end) } 
}

const REPORT_ICONS: Record<string, any> = {
  attendance: UserCheck,
  timesheet: Clock,
  activity: Activity,
  payroll: CreditCard,
  billing: FileText,
  leave: Coffee
}

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
      <div className="space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 border border-indigo-100">
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
            <p className="text-slate-500 text-sm">Generate and export detailed insights</p>
          </div>
        </div>

        <GlassCard 
          title={
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              <span>Report Configuration</span>
            </div>
          }
          className="relative overflow-hidden"
        >
          <FileText size={120} className="text-indigo-900/5 absolute -bottom-4 -right-4 pointer-events-none" />
          <div className="relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Building className="w-4 h-4 text-slate-400" /> Organization
                </label>
                <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
                  <option value="">Select Organization</option>
                  {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
                </GlassSelect>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <FileType className="w-4 h-4 text-slate-400" /> Report Type
                </label>
                <GlassSelect value={reportType} onChange={(e:any)=>setReportType(e.target.value)}>
                  <option value="attendance">Attendance</option>
                  <option value="timesheet">Timesheets</option>
                  <option value="activity">Activity</option>
                  <option value="payroll">Payroll</option>
                  <option value="billing">Billing</option>
                  <option value="leave">Leave</option>
                </GlassSelect>
                {desc && (
                  <div className="text-xs text-indigo-600 mt-1 bg-indigo-50 p-2 rounded-lg border border-indigo-100 flex items-start gap-2">
                    <div className="mt-0.5 min-w-[12px]"><FileText size={12} /></div>
                    <span>Includes: {desc}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-slate-400" /> Format
                </label>
                <GlassSelect value={format} onChange={(e:any)=>setFormat(e.target.value)}>
                  <option value="csv">CSV (Excel)</option>
                  <option value="xlsx">Excel (XLSX)</option>
                  <option value="pdf">PDF Document</option>
                </GlassSelect>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-100">
               <FilterBar pageKey="reports" orgId={orgId} config={filterConfig} showSavedViews />
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center gap-4 justify-end">
              <label className="flex items-center gap-2 cursor-pointer select-none bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-all">
                <div className="relative flex items-center">
                  <input type="checkbox" className="peer sr-only" checked={runAsync} onChange={(e)=>setRunAsync(e.target.checked)} />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </div>
                <span className="text-sm font-medium text-slate-600">Run in Background</span>
              </label>
              
              <GlassButton 
                variant="primary" 
                onClick={()=>{ if (!orgId || downloading) return; generate() }} 
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={!orgId || downloading}
              >
                {downloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                {downloading ? 'Generating...' : 'Generate Report'}
              </GlassButton>
            </div>
          </div>
        </GlassCard>

        {rows.length > 0 && (
          <GlassCard title="Preview" className="relative overflow-hidden">
             <div className="max-h-[400px] overflow-auto rounded-xl border border-slate-200">
               <GlassTable columns={columns} rows={rows} />
             </div>
          </GlassCard>
        )}

        <GlassCard 
          title={
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-500" />
              <span>History</span>
            </div>
          } 
          right={<ExportMenu onExport={handleExport} isExporting={isExporting} />}
          className="relative overflow-hidden"
        >
          <History size={120} className="text-slate-900/5 absolute -bottom-4 -right-4 pointer-events-none" />
          <div className="relative z-10">
            {jobs.length === 0 ? (
               <div className="text-center py-8 text-slate-500">
                 No recent report jobs found.
               </div>
            ) : (
               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                   <thead className="text-xs text-slate-500 uppercase bg-slate-50/50">
                     <tr>
                       <th className="px-4 py-3">Created</th>
                       <th className="px-4 py-3">Type</th>
                       <th className="px-4 py-3">Status</th>
                       <th className="px-4 py-3">Download</th>
                     </tr>
                   </thead>
                   <tbody>
                     {jobs.map(j => (
                       <tr key={j.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                         <td className="px-4 py-3">{new Date(j.created_at).toLocaleString()}</td>
                         <td className="px-4 py-3 capitalize flex items-center gap-2">
                           {REPORT_ICONS[j.report_type] && (() => {
                             const Icon = REPORT_ICONS[j.report_type]
                             return <Icon size={14} className="text-indigo-500" />
                           })()}
                           {j.report_type}
                         </td>
                         <td className="px-4 py-3">
                           <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                             j.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                             j.status === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                             'bg-amber-50 text-amber-700 border border-amber-100'
                           }`}>
                             {j.status}
                           </span>
                         </td>
                         <td className="px-4 py-3">
                           {j.file_url ? (
                             <a href={j.file_url} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline">
                               <Download size={14} /> Download
                             </a>
                           ) : (
                             <span className="text-slate-400">-</span>
                           )}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            )}
          </div>
        </GlassCard>
      </div>
    </AppShell>
  )
}
