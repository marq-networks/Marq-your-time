'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassModal from '@components/ui/GlassModal'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'

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

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store' }); const d = await res.json(); setOrgs(d.items||[]); if (!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadDepsUsers = async (oid: string) => { if (!oid) return; const [dRes, uRes] = await Promise.all([ fetch(`/api/department/list?orgId=${oid}`, { cache:'no-store' }), fetch(`/api/user/list?orgId=${oid}`, { cache:'no-store' }) ]); const [d,u] = await Promise.all([dRes.json(), uRes.json()]); setDepartments(d.items||[]); setMembers(u.items||[]) }
  const loadItems = async () => { if (!orgId) return; const qs = new URLSearchParams(); qs.set('org_id', orgId); if (memberId) qs.set('member_id', memberId); if (severity) qs.set('severity', severity); if (insightType) qs.set('insight_type', insightType); if (ack) qs.set('acknowledged', ack); if (start && end) { qs.set('date_start', start); qs.set('date_end', end) }; const res = await fetch(`/api/insights/list?${qs.toString()}`, { cache:'no-store', headers:{ 'x-user-id': 'demo-user' } }); const d = await res.json(); const depMembers = departmentId ? members.filter(m => m.id && m.id) : members; const filtered = departmentId ? (d.insights||d.items||[]).filter((it:any)=> depMembers.some(m => m.id === it.member_id)) : (d.insights||d.items||[]); const searched = memberSearch ? filtered.filter((it:any)=> String(it.member_name||'').toLowerCase().includes(memberSearch.toLowerCase())) : filtered; setItems(searched) }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId) loadDepsUsers(orgId) }, [orgId])
  useEffect(()=>{ if(orgId) loadItems() }, [orgId, memberId, severity, departmentId])

  const columns = ['Member','Department','Type','Severity','Summary','Start','End','Status','Created','Actions']
  const initials = (name: string) => (name||'').split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase()
  const rows = items.map(it => [
    <div className="row" style={{alignItems:'center',gap:8}}>
      {it.avatar_url ? <img src={it.avatar_url} alt="avatar" style={{width:24,height:24,borderRadius:999}} /> : <div style={{width:24,height:24,borderRadius:999,display:'grid',placeItems:'center',background:'rgba(255,255,255,0.6)',border:'1px solid rgba(255,255,255,0.7)'}}>{initials(String(it.member_name||''))}</div>}
      <span style={{ fontWeight:600 }}>{it.member_name}</span>
    </div>,
    <div className="subtitle">{it.department_name || '-'}</div>,
    <span className="tag-pill">{it.insight_type}</span>,
    <span className="tag-pill" style={{ background: it.severity==='high' ? '#39FF14' : 'rgba(255,255,255,0.4)', borderColor: it.severity==='high' ? '#39FF14' : 'rgba(255,255,255,0.5)' }}>{it.severity}</span>,
    <div style={{ maxWidth:360, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{it.summary}</div>,
    it.date_start || '-',
    it.date_end || '-',
    <span className="badge" style={{ background: it.acknowledged ? 'rgba(255,255,255,0.5)' : '#39FF14', borderColor: it.acknowledged ? 'rgba(255,255,255,0.6)' : '#39FF14' }}>{it.acknowledged ? 'Acknowledged' : 'Not acknowledged'}</span>,
    it.created_at ? new Date(it.created_at).toLocaleString() : '-',
    <div className="row" style={{gap:8}}>
      <GlassButton variant="secondary" onClick={()=>setOpen({ id: it.id, details: it.details, member_name: it.member_name, department_name: it.department_name, date_start: it.date_start, date_end: it.date_end, type: it.insight_type, severity: it.severity, summary: it.summary })} style={{ background:'rgba(255,255,255,0.6)' }}>View details</GlassButton>
      {!it.acknowledged && <GlassButton variant="primary" onClick={async()=>{ await fetch('/api/insights/acknowledge', { method:'POST', headers:{ 'Content-Type':'application/json','x-user-id':'demo-user' }, body: JSON.stringify({ insight_id: it.id }) }); loadItems() }} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Acknowledge</GlassButton>}
    </div>
  ])

  return (
    <AppShell title="Insights">
      <div style={{ background: 'linear-gradient(135deg, #d9c7b2, #e8ddce 50%, #c9b8a4)', padding: 8, borderRadius: 28 }}>
      <GlassCard title="Filters" right={(
        <div className="row" style={{ gap:12 }}>
          <GlassButton variant="primary" onClick={()=>{ const today = new Date().toISOString().slice(0,10); setStart(today); setEnd(today) }} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Today</GlassButton>
          <GlassButton variant="primary" onClick={()=>{ const t = new Date().toISOString().slice(0,10); const s = new Date(Date.now()-6*86400000).toISOString().slice(0,10); setStart(s); setEnd(t) }} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Last 7 days</GlassButton>
          <GlassButton variant="primary" onClick={()=>{ const t = new Date().toISOString().slice(0,10); const s = new Date(Date.now()-13*86400000).toISOString().slice(0,10); setStart(s); setEnd(t) }} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Last 14 days</GlassButton>
          <GlassButton variant="primary" onClick={()=>{ const t = new Date().toISOString().slice(0,10); const s = new Date(Date.now()-29*86400000).toISOString().slice(0,10); setStart(s); setEnd(t) }} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Last 30 days</GlassButton>
        </div>
      )}>
        <div className="grid grid-3">
          <div>
            <div className="label">Organization</div>
            <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">Department</div>
            <GlassSelect value={departmentId} onChange={(e:any)=>setDepartmentId(e.target.value)}>
              <option value="">All</option>
              {departments.map(d=> <option key={d.id} value={d.id}>{d.name}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">Member</div>
            <GlassSelect value={memberId} onChange={(e:any)=>setMemberId(e.target.value)}>
              <option value="">All</option>
              {members.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">Member search</div>
            <input className="input" placeholder="Search by name" value={memberSearch} onChange={(e)=>setMemberSearch(e.target.value)} />
          </div>
          <div>
            <div className="label">Severity</div>
            <GlassSelect value={severity} onChange={(e:any)=>setSeverity(e.target.value)}>
              <option value="">All</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </GlassSelect>
          </div>
          <div>
            <div className="label">Type</div>
            <GlassSelect value={insightType} onChange={(e:any)=>setInsightType(e.target.value)}>
              <option value="">All</option>
              <option value="late_starts">late_starts</option>
              <option value="idle_spike">idle_spike</option>
              <option value="overwork">overwork</option>
              <option value="burnout_risk">burnout_risk</option>
              <option value="performance_drop">performance_drop</option>
            </GlassSelect>
          </div>
          <div>
            <div className="label">Acknowledged</div>
            <GlassSelect value={ack} onChange={(e:any)=>setAck(e.target.value)}>
              <option value="">All</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </GlassSelect>
          </div>
          <div className="grid grid-2">
            <div>
              <div className="label">Start</div>
              <input className="input" type="date" value={start} onChange={(e)=>setStart(e.target.value)} />
            </div>
            <div>
              <div className="label">End</div>
              <input className="input" type="date" value={end} onChange={(e)=>setEnd(e.target.value)} />
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Insights">
        <GlassTable columns={columns} rows={rows} />
      </GlassCard>

      <GlassModal open={!!open} title="Insight Details" onClose={()=>setOpen(null)}>
        {open && (
          <div>
            <div className="grid grid-2">
              <div>
                <div className="label">Member</div>
                <div className="subtitle">{open.member_name}</div>
              </div>
              <div>
                <div className="label">Department</div>
                <div className="subtitle">{open.department_name || '-'}</div>
              </div>
            </div>
            <div className="grid grid-3" style={{ marginTop:12 }}>
              <div>
                <div className="label">Type</div>
                <div className="subtitle">{open.type}</div>
              </div>
              <div>
                <div className="label">Severity</div>
                <div className="subtitle">{open.severity}</div>
              </div>
              <div>
                <div className="label">Range</div>
                <div className="subtitle">{open.date_start} → {open.date_end}</div>
              </div>
            </div>
            <div style={{ marginTop:12 }}>
              <div className="label">Summary</div>
              <div className="subtitle">{open.summary}</div>
            </div>
            <div style={{ marginTop:12 }}>
              <div className="label">Details</div>
              <div className="subtitle">
                {(() => {
                  const d = open.details||{}
                  const lines: string[] = []
                  if (open.type === 'late_starts' && d.difference_minutes) lines.push(`Late start around +${d.difference_minutes} minutes.`)
                  if (open.type === 'idle_spike' && d.today_idle_minutes && d.average_idle_minutes) lines.push(`Idle minutes: ${d.today_idle_minutes} vs baseline ${d.average_idle_minutes}.`)
                  if (open.type === 'overwork' && d.consecutive_days_over_threshold) lines.push(`Consecutive days over threshold: ${d.consecutive_days_over_threshold}.`)
                  if (open.type === 'burnout_risk' && d.total7_worked_minutes !== undefined) lines.push(`Total worked over 7 days: ${Math.round((d.total7_worked_minutes||0)/60)}h.`)
                  if (open.type === 'performance_drop' && d.today_worked_minutes !== undefined && d.average_worked_minutes !== undefined) lines.push(`Worked minutes: ${d.today_worked_minutes} vs baseline ${d.average_worked_minutes}.`)
                  return lines.length ? lines.map((l,i)=><div key={i}>{l}</div>) : <pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(open.details, null, 2)}</pre>
                })()}
              </div>
            </div>
            <div style={{ marginTop:12 }}>
              <div className="subtitle">You may want to check in with this teammate to see if their schedule or workload needs adjustment. Consider recommending more structured breaks or adjusting shift times.</div>
            </div>
            <div className="row" style={{ justifyContent:'flex-end', gap:8, marginTop:12 }}>
              <GlassButton variant="primary" onClick={async()=>{ await fetch('/api/insights/acknowledge', { method:'POST', headers:{ 'Content-Type':'application/json','x-user-id':'demo-user' }, body: JSON.stringify({ insight_id: open.id }) }); setOpen({ ...open, acknowledged: true }) }} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Acknowledge insight</GlassButton>
            </div>
          </div>
        )}
      </GlassModal>
      </div>
    </AppShell>
  )
}
