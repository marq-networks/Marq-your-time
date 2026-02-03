'use client'
import { useEffect, useState, useMemo } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassModal from '@components/ui/GlassModal'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import ExportMenu from '@components/shared/ExportMenu'
import { ExportColumn, exportToCsv, exportToPdf } from '@lib/export-utils'
import { Sparkles, Filter, Calendar, Users, Search, AlertTriangle, CheckCircle, Clock, Info, Building, LayoutGrid, X } from 'lucide-react'

type Org = { id: string, orgName: string }
type Department = { id: string, name: string }
type Member = { id: string, firstName: string, lastName: string }
type Insight = { id: string, member_id: string, member_name: string, department_name?: string, avatar_url?: string, insight_type: string, severity: string, summary: string, date_range: string, details: any, created_at?: string, acknowledged?: boolean, date_start?: string, date_end?: string }

export default function InsightsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [orgId, setOrgId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [severity, setSeverity] = useState('')
  const [insightType, setInsightType] = useState('')
  const [ack, setAck] = useState('')
  const [start, setStart] = useState(new Date().toISOString().slice(0,10))
  const [end, setEnd] = useState(new Date().toISOString().slice(0,10))
  const [items, setItems] = useState<Insight[]>([])
  const [open, setOpen] = useState<{ id?: string, details?: any, member_name?: string, department_name?: string, date_start?: string, date_end?: string, type?: string, severity?: string, summary?: string, acknowledged?: boolean } | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store' }); const d = await res.json(); setOrgs(d.items||[]); if (!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadDepsUsers = async (oid: string) => { if (!oid) return; const [dRes, uRes] = await Promise.all([ fetch(`/api/department/list?orgId=${oid}`, { cache:'no-store' }), fetch(`/api/user/list?orgId=${oid}`, { cache:'no-store' }) ]); const [d,u] = await Promise.all([dRes.json(), uRes.json()]); setDepartments(d.items||[]); setMembers(u.items||[]) }
  const loadItems = async () => { if (!orgId) return; const qs = new URLSearchParams(); qs.set('org_id', orgId); if (memberId) qs.set('member_id', memberId); if (severity) qs.set('severity', severity); if (insightType) qs.set('insight_type', insightType); if (ack) qs.set('acknowledged', ack); if (start && end) { qs.set('date_start', start); qs.set('date_end', end) }; const res = await fetch(`/api/insights/list?${qs.toString()}`, { cache:'no-store', headers:{ 'x-user-id': 'demo-user' } }); const d = await res.json(); const depMembers = departmentId ? members.filter(m => m.id && m.id) : members; const filtered = departmentId ? (d.insights||d.items||[]).filter((it:any)=> depMembers.some(m => m.id === it.member_id)) : (d.insights||d.items||[]); const searched = memberSearch ? filtered.filter((it:any)=> String(it.member_name||'').toLowerCase().includes(memberSearch.toLowerCase())) : filtered; setItems(searched) }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId) loadDepsUsers(orgId) }, [orgId])
  useEffect(()=>{ if(orgId) loadItems() }, [orgId, memberId, severity, departmentId])

  const stats = useMemo(() => {
    return {
      total: items.length,
      actionRequired: items.filter(i => !i.acknowledged).length,
      highSeverity: items.filter(i => i.severity === 'high').length,
      burnoutRisk: items.filter(i => i.insight_type === 'burnout_risk').length
    }
  }, [items])

  const columns = ['Member','Department','Type','Severity','Summary','Start','End','Status','Created','Actions']
  const initials = (name: string) => (name||'').split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase()
  
  const getSeverityBadge = (sev: string) => {
    switch(sev) {
      case 'high': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700 border border-rose-200"><AlertTriangle size={10} /> High</span>
      case 'medium': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">Medium</span>
      case 'low': return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">Low</span>
      default: return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">{sev}</span>
    }
  }

  const getTypeBadge = (type: string) => {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 capitalize">{type.replace(/_/g, ' ')}</span>
  }

  const rows = items.map(it => [
    <div className="flex items-center gap-3">
      {it.avatar_url ? 
        <img src={it.avatar_url} alt="avatar" className="w-8 h-8 rounded-full object-cover border border-slate-200" /> : 
        <div className="w-8 h-8 rounded-full grid place-items-center bg-indigo-100 text-indigo-600 text-xs font-bold border border-indigo-200">
          {initials(String(it.member_name||''))}
        </div>
      }
      <span className="font-semibold text-slate-700">{it.member_name}</span>
    </div>,
    <div className="text-sm text-slate-600">{it.department_name || '-'}</div>,
    getTypeBadge(it.insight_type),
    getSeverityBadge(it.severity),
    <div className="max-w-xs truncate text-sm text-slate-600" title={it.summary}>{it.summary}</div>,
    <span className="text-xs text-slate-500 font-mono">{it.date_start || '-'}</span>,
    <span className="text-xs text-slate-500 font-mono">{it.date_end || '-'}</span>,
    it.acknowledged ? 
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200"><CheckCircle size={10} /> Ack</span> : 
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">Pending</span>,
    <span className="text-xs text-slate-400">{it.created_at ? new Date(it.created_at).toLocaleDateString() : '-'}</span>,
    <div className="flex items-center gap-2">
      <GlassButton size="sm" variant="secondary" onClick={()=>setOpen({ id: it.id, details: it.details, member_name: it.member_name, department_name: it.department_name, date_start: it.date_start, date_end: it.date_end, type: it.insight_type, severity: it.severity, summary: it.summary, acknowledged: it.acknowledged })}>
        Details
      </GlassButton>
    </div>
  ])

  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      if (items.length === 0) {
        alert('No data to export')
        return
      }
      const exportColumns: ExportColumn[] = [
        { header: 'Member', accessor: 'member_name' },
        { header: 'Department', accessor: (item) => item.department_name || '-' },
        { header: 'Type', accessor: 'insight_type' },
        { header: 'Severity', accessor: 'severity' },
        { header: 'Summary', accessor: 'summary' },
        { header: 'Start', accessor: (item) => item.date_start || '-' },
        { header: 'End', accessor: (item) => item.date_end || '-' },
        { header: 'Status', accessor: (item) => item.acknowledged ? 'Acknowledged' : 'Not acknowledged' },
        { header: 'Created', accessor: (item) => item.created_at ? new Date(item.created_at).toLocaleDateString() : '-' }
      ]
      const filename = `marq_insights_${orgId}_${new Date().toISOString().split('T')[0]}`
      if (type === 'csv') {
        await exportToCsv(items, exportColumns, filename)
      } else {
        await exportToPdf(items, exportColumns, 'Insights', filename)
      }
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const setDateRange = (days: number) => {
    const t = new Date().toISOString().slice(0,10)
    if (days === 0) {
      setStart(t)
      setEnd(t)
    } else {
      const s = new Date(Date.now() - days * 86400000).toISOString().slice(0,10)
      setStart(s)
      setEnd(t)
    }
  }

  return (
    <AppShell title="AI Insights">
      <GlassCard 
        title={
          <div className="flex items-center gap-2">
            <Sparkles className="text-indigo-600" size={20} />
            <span>Analysis & Insights</span>
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            <ExportMenu onExport={handleExport} isExporting={isExporting} />
            <div className="hidden md:flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              {[
                { label: 'Today', days: 0 },
                { label: '7d', days: 6 },
                { label: '14d', days: 13 },
                { label: '30d', days: 29 }
              ].map(opt => (
                <button
                  key={opt.label}
                  onClick={() => setDateRange(opt.days)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    (opt.days === 0 && start === end && start === new Date().toISOString().slice(0,10)) ||
                    (opt.days > 0 && start === new Date(Date.now() - opt.days * 86400000).toISOString().slice(0,10))
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4 mb-6 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
                <Building size={12} />
                Organization
              </div>
              <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)} className="w-full bg-white">
                <option value="">Select org</option>
                {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
              </GlassSelect>
            </div>
            
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
                <Users size={12} />
                Department
              </div>
              <GlassSelect value={departmentId} onChange={(e:any)=>setDepartmentId(e.target.value)} className="w-full bg-white">
                <option value="">All Departments</option>
                {departments.map(d=> <option key={d.id} value={d.id}>{d.name}</option>)}
              </GlassSelect>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
                <LayoutGrid size={12} />
                Insight Type
              </div>
              <GlassSelect value={insightType} onChange={(e:any)=>setInsightType(e.target.value)} className="w-full bg-white">
                <option value="">All Types</option>
                <option value="late_starts">Late Starts</option>
                <option value="idle_spike">High Idle Time</option>
                <option value="overwork">Overwork Risk</option>
                <option value="burnout_risk">Burnout Risk</option>
                <option value="performance_drop">Performance Drop</option>
              </GlassSelect>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
                <AlertTriangle size={12} />
                Severity
              </div>
              <GlassSelect value={severity} onChange={(e:any)=>setSeverity(e.target.value)} className="w-full bg-white">
                <option value="">All Severities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </GlassSelect>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-slate-200/50">
             <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
                <Search size={12} />
                Member Search
              </div>
              <div className="relative">
                <input 
                  className="input w-full bg-white pl-8 text-sm" 
                  placeholder="Search member..." 
                  value={memberSearch} 
                  onChange={(e)=>setMemberSearch(e.target.value)} 
                />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
                <CheckCircle size={12} />
                Status
              </div>
              <GlassSelect value={ack} onChange={(e:any)=>setAck(e.target.value)} className="w-full bg-white">
                <option value="">All Status</option>
                <option value="true">Acknowledged</option>
                <option value="false">Pending</option>
              </GlassSelect>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
                <Calendar size={12} />
                Start Date
              </div>
              <input className="input w-full bg-white text-sm" type="date" value={start} onChange={(e)=>setStart(e.target.value)} />
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
                <Calendar size={12} />
                End Date
              </div>
              <input className="input w-full bg-white text-sm" type="date" value={end} onChange={(e)=>setEnd(e.target.value)} />
            </div>
          </div>
        </div>

        {items.length > 0 ? (
          <GlassTable columns={columns} rows={rows} />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-slate-50/30 rounded-xl border border-dashed border-slate-200">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
              <Sparkles size={32} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-600 mb-1">No insights found</h3>
            <p className="text-sm text-slate-500">Try adjusting your filters or date range</p>
          </div>
        )}
      </GlassCard>

      <GlassModal open={!!open} title="Insight Details" onClose={()=>setOpen(null)}>
        {open && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="h-12 w-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-lg font-bold text-indigo-600 shadow-sm">
                 {initials(open.member_name||'')}
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg">{open.member_name}</h3>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Building size={14} />
                  {open.department_name || 'No Department'}
                </div>
              </div>
              <div className="ml-auto flex flex-col items-end gap-1">
                 {getSeverityBadge(open.severity || 'low')}
                 {getTypeBadge(open.type || 'unknown')}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border border-slate-100 bg-white">
                <div className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Date Range</div>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Clock size={14} className="text-indigo-500" />
                  {open.date_start} → {open.date_end}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-slate-100 bg-white">
                <div className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Status</div>
                <div className="text-sm font-medium">
                  {open.acknowledged ? 
                    <span className="text-emerald-600 flex items-center gap-1"><CheckCircle size={14} /> Acknowledged</span> : 
                    <span className="text-amber-600 flex items-center gap-1"><AlertTriangle size={14} /> Action Required</span>
                  }
                </div>
              </div>
            </div>

            <div>
              <h4 className="flex items-center gap-2 font-semibold text-slate-800 mb-2">
                <Info size={16} className="text-indigo-500" />
                Summary
              </h4>
              <p className="text-sm text-slate-600 leading-relaxed bg-white p-3 rounded-lg border border-slate-100">
                {open.summary}
              </p>
            </div>

            <div>
              <h4 className="flex items-center gap-2 font-semibold text-slate-800 mb-2">
                <LayoutGrid size={16} className="text-indigo-500" />
                Analysis Details
              </h4>
              <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 border border-slate-100 space-y-2">
                {(() => {
                  const d = open.details||{}
                  const lines: string[] = []
                  if (open.type === 'late_starts' && d.difference_minutes) lines.push(`• Late start observed: +${d.difference_minutes} minutes deviation from schedule.`)
                  if (open.type === 'idle_spike' && d.today_idle_minutes && d.average_idle_minutes) lines.push(`• Idle time spike: ${d.today_idle_minutes}m today vs ${d.average_idle_minutes}m baseline average.`)
                  if (open.type === 'overwork' && d.consecutive_days_over_threshold) lines.push(`• Consecutive days exceeding work threshold: ${d.consecutive_days_over_threshold} days.`)
                  if (open.type === 'burnout_risk' && d.total7_worked_minutes !== undefined) lines.push(`• Total hours worked (last 7 days): ${(Math.round((d.total7_worked_minutes||0)/60 * 10)/10)} hours.`)
                  if (open.type === 'performance_drop' && d.today_worked_minutes !== undefined && d.average_worked_minutes !== undefined) lines.push(`• Significant drop in worked minutes: ${d.today_worked_minutes}m vs ${d.average_worked_minutes}m baseline.`)
                  
                  return lines.length ? lines.map((l,i)=><div key={i}>{l}</div>) : <pre className="text-xs">{JSON.stringify(open.details, null, 2)}</pre>
                })()}
              </div>
            </div>

            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
               <h5 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2 flex items-center gap-2">
                 <Sparkles size={12} />
                 Recommendation
               </h5>
               <p className="text-sm text-indigo-900/80">
                 You may want to check in with this teammate to see if their schedule or workload needs adjustment. Consider recommending more structured breaks or adjusting shift times to prevent burnout.
               </p>
            </div>

            {!open.acknowledged && (
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <GlassButton 
                  variant="primary" 
                  onClick={async()=>{ 
                    await fetch('/api/insights/acknowledge', { method:'POST', headers:{ 'Content-Type':'application/json','x-user-id':'demo-user' }, body: JSON.stringify({ insight_id: open.id }) }); 
                    setOpen({ ...open, acknowledged: true });
                    loadItems(); // Refresh list to update status
                  }} 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-lg shadow-emerald-200"
                >
                  <CheckCircle size={16} className="mr-2" />
                  Acknowledge Insight
                </GlassButton>
              </div>
            )}
          </div>
        )}
      </GlassModal>
    </AppShell>
  )
}
