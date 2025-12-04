'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'

type Org = { id: string, orgName: string }

export default function BillingPlansPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [plans, setPlans] = useState<any[]>([])
  const [current, setCurrent] = useState<any>(null)
  const [seats, setSeats] = useState('')
  const [preview, setPreview] = useState<{ monthly: number, currency: string } | null>(null)

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store' }); const d = await res.json(); setOrgs(d.items||[]); if(!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadPlans = async () => { const res = await fetch('/api/billing/plans/list', { cache:'no-store' }); const d = await res.json(); setPlans(d.items||[]) }
  const loadCurrent = async (oid: string) => { if(!oid) return; const res = await fetch(`/api/billing/subscriptions/current?org_id=${oid}`, { cache:'no-store', headers: { 'x-role': 'admin' } }); const d = await res.json(); setCurrent(d.subscription || null); setSeats(String(d.subscription?.seats || '')) }
  const subscribe = async (planId: string) => { if(!orgId) return; const s = Number(seats||0); const res = await fetch('/api/billing/subscriptions/subscribe', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ org_id: orgId, plan_id: planId, seats: s }) }); if(res.ok) loadCurrent(orgId) }
  const updateSeats = async () => { if(!orgId) return; const s = Number(seats||0); const res = await fetch('/api/billing/subscriptions/update-seats', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ org_id: orgId, seats: s }) }); if(res.ok) loadCurrent(orgId) }

  const recalcPreview = (plan: any, s: number) => {
    if (!plan || !s) { setPreview(null); return }
    const monthly = Math.round(Number(plan.price_per_seat||0) * s)
    setPreview({ monthly, currency: plan.currency || 'USD' })
  }

  useEffect(()=>{ loadOrgs(); loadPlans() }, [])
  useEffect(()=>{ if(orgId) loadCurrent(orgId) }, [orgId])

  const columns = ['Code','Name','Price/Seat','Price/Login','Currency','Action']
  const rows = plans.map(p => [ p.code, p.name, `$${p.price_per_seat}`, p.price_per_login? `$${p.price_per_login}`:'-', p.currency, <GlassButton key={p.id} onClick={()=>{ subscribe(p.id) }}>Choose</GlassButton> ])

  return (
    <AppShell title="Billing Plans">
      <div className="glass-panel bg-gradient-to-br from-[#d9c7b2] via-[#e8ddce] to-[#c9b8a4]" style={{padding:20,borderRadius:28,border:'1px solid rgba(255,255,255,0.35)',backdropFilter:'blur(12px)'}}>
        <div className="card-title">Your Organization</div>
        <div className="grid grid-2">
          <div>
            <div className="label">Organization</div>
            <select className="input" value={orgId} onChange={e=>setOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </select>
          </div>
          <div>
            <div className="label">Current Plan</div>
            <div className="row" style={{gap:12,alignItems:'center'}}>
              <span className="badge">{current?.plan?.code || 'legacy/manual'}</span>
              <span className="subtitle">Seats</span>
              <div className="row" style={{gap:8}}>
                <button className="btn" onClick={()=>{ const s = Math.max(0, Number(seats||0)-1); setSeats(String(s)); if(current?.plan) recalcPreview(current.plan, s) }}>-</button>
                <input className="input" type="number" value={seats} onChange={e=>{ setSeats(e.target.value); if(current?.plan) recalcPreview(current.plan, Number(e.target.value||0)) }} style={{width:120}} />
                <button className="btn" onClick={()=>{ const s = Number(seats||0)+1; setSeats(String(s)); if(current?.plan) recalcPreview(current.plan, s) }}>+</button>
              </div>
              <GlassButton onClick={updateSeats} variant="primary">Update Seats</GlassButton>
              <GlassButton href="/billing">View Invoices</GlassButton>
            </div>
            {preview && (
              <div className="row" style={{ gap: 12, marginTop: 12 }}>
                <div className="subtitle">Preview Monthly</div>
                <div className="title" style={{ color: '#39FF14' }}>{preview.currency} ${Math.round(preview.monthly).toLocaleString()}</div>
                <GlassButton variant="primary" onClick={()=>{ if(current?.plan) subscribe(current.plan.id) }}>Confirm</GlassButton>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel bg-gradient-to-br from-[#d9c7b2] via-[#e8ddce] to-[#c9b8a4]" style={{padding:20,borderRadius:28,border:'1px solid rgba(255,255,255,0.35)',backdropFilter:'blur(12px)'}}>
        <div className="card-title">Available Plans</div>
        <GlassTable columns={columns} rows={rows} />
      </div>
    </AppShell>
  )
}
