'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'

type Org = { id: string, orgName: string }
type Snapshot = { id: string, orgId: string, targetType: string, targetId?: string, snapshotDate: string, summary?: string, metadata?: any, createdAt: number }

export default function OrgInsightsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [start, setStart] = useState(new Date(Date.now()-6*86400000).toISOString().slice(0,10))
  const [end, setEnd] = useState(new Date().toISOString().slice(0,10))
  const [items, setItems] = useState<Snapshot[]>([])

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store' }); const d = await res.json(); setOrgs(d.items||[]); if (!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadItems = async () => { if (!orgId) return; const qs = new URLSearchParams(); qs.set('org_id', orgId); qs.set('target_type', 'org'); qs.set('period_start', start); qs.set('period_end', end); const res = await fetch(`/api/ai-insights/list?${qs.toString()}`, { cache:'no-store' }); const d = await res.json(); setItems(d.items||[]) }
  const generate = async () => { if (!orgId) return; await fetch('/api/ai-insights/generate', { method:'POST', headers:{ 'Content-Type':'application/json','x-user-id':'demo-user' }, body: JSON.stringify({ org_id: orgId, target_type: 'org', period_start: start, period_end: end }) }); loadItems() }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId) loadItems() }, [orgId, start, end])

  return (
    <AppShell title="Org Insights">
      <div style={{ background: 'linear-gradient(135deg, #d9c7b2, #e8ddce 50%, #c9b8a4)', padding: 8, borderRadius: 28 }}>
        <GlassCard title="Filters" right={(
          <div className="row" style={{ gap:12 }}>
            <GlassButton variant="primary" onClick={()=>generate()} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Generate</GlassButton>
          </div>
        )}>
          <div className="grid grid-3">
            <div>
              <div className="label">Organization</div>
              <select className="input" value={orgId} onChange={(e)=>setOrgId(e.target.value)}>
                <option value="">Select org</option>
                {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
              </select>
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

        <div className="grid grid-2" style={{ marginTop: 12 }}>
          {items.map(it => (
            <div key={it.id} className="glass-panel" style={{padding:16,borderRadius:'var(--radius-large)'}}>
              <div className="row" style={{ justifyContent:'space-between' }}>
                <div className="card-title">{it.snapshotDate}</div>
                <span className="tag-pill" style={{ background:'#39FF14', borderColor:'#39FF14' }}>suggestions</span>
              </div>
              <div className="subtitle" style={{ marginTop:8 }}>{it.summary || 'No summary'}</div>
              <details style={{ marginTop:8 }}>
                <summary>View details</summary>
                <pre style={{ whiteSpace:'pre-wrap' }}>{JSON.stringify(it.metadata||{}, null, 2)}</pre>
              </details>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
