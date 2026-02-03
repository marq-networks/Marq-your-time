'use client'

import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import ExportMenu from '@components/shared/ExportMenu'
import { exportToCsv, exportToPdf, type ExportColumn } from '@lib/export-utils'
import { 
  Building2, 
  CreditCard, 
  Users, 
  Search, 
  Minus, 
  Plus, 
  CheckCircle,
  Briefcase,
  DollarSign,
  Globe,
  FileText,
  ChevronDown
} from 'lucide-react'

type Org = { id: string, orgName: string }

export default function BillingPlansPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [plans, setPlans] = useState<any[]>([])
  const [current, setCurrent] = useState<any>(null)
  const [seats, setSeats] = useState('')
  const [preview, setPreview] = useState<{ monthly: number, currency: string } | null>(null)
  const [search, setSearch] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const loadOrgs = async () => { 
    try {
      const res = await fetch('/api/org/list', { cache:'no-store' })
      const d = await res.json()
      setOrgs(d.items||[])
      if(!orgId && d.items?.length) setOrgId(d.items[0].id)
    } catch (e) {
      console.error('Failed to load orgs', e)
    }
  }

  const loadPlans = async () => { 
    try {
      const res = await fetch('/api/billing/plans/list', { cache:'no-store' })
      const d = await res.json()
      setPlans(d.items||[])
    } catch (e) {
      console.error('Failed to load plans', e)
    }
  }

  const loadCurrent = async (oid: string) => { 
    if(!oid) return
    try {
      const res = await fetch(`/api/billing/subscriptions/current?org_id=${oid}`, { 
        cache:'no-store', 
        headers: { 'x-role': 'admin' } 
      })
      const d = await res.json()
      setCurrent(d.subscription || null)
      setSeats(String(d.subscription?.seats || ''))
    } catch (e) {
      console.error('Failed to load subscription', e)
    }
  }

  const subscribe = async (planId: string) => { 
    if(!orgId) return
    const s = Number(seats||0)
    try {
      const res = await fetch('/api/billing/subscriptions/subscribe', { 
        method:'POST', 
        headers:{ 'Content-Type':'application/json' }, 
        body: JSON.stringify({ org_id: orgId, plan_id: planId, seats: s }) 
      })
      if(res.ok) loadCurrent(orgId)
    } catch (e) {
      console.error('Failed to subscribe', e)
    }
  }

  const updateSeats = async () => { 
    if(!orgId) return
    const s = Number(seats||0)
    try {
      const res = await fetch('/api/billing/subscriptions/update-seats', { 
        method:'POST', 
        headers:{ 'Content-Type':'application/json' }, 
        body: JSON.stringify({ org_id: orgId, seats: s }) 
      })
      if(res.ok) loadCurrent(orgId)
    } catch (e) {
      console.error('Failed to update seats', e)
    }
  }

  const recalcPreview = (plan: any, s: number) => {
    if (!plan || !s) { setPreview(null); return }
    const monthly = Math.round(Number(plan.price_per_seat||0) * s)
    setPreview({ monthly, currency: plan.currency || 'USD' })
  }

  useEffect(()=>{ loadOrgs(); loadPlans() }, [])
  useEffect(()=>{ if(orgId) loadCurrent(orgId) }, [orgId])

  const columns = ['Code','Name','Price/Seat','Price/Login','Currency','Action']
  
  const filteredPlans = plans.filter(p => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    const text = `${p.code||''} ${p.name||''} ${p.currency||''}`.toLowerCase()
    return text.includes(q)
  })
  
  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      const exportItems = filteredPlans
      const exportColumns: ExportColumn[] = [
        { header: 'Code', accessor: 'code' },
        { header: 'Name', accessor: 'name' },
        { header: 'Price/Seat', accessor: (p) => `$${p.price_per_seat}` },
        { header: 'Price/Login', accessor: (p) => p.price_per_login ? `$${p.price_per_login}` : '-' },
        { header: 'Currency', accessor: 'currency' }
      ]
      
      const filename = `marq_billing_plans_${new Date().toISOString().split('T')[0]}`

      if (type === 'csv') {
        await exportToCsv(exportItems, exportColumns, filename)
      } else {
        await exportToPdf(exportItems, exportColumns, 'Billing Plans', filename)
      }
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const rows = filteredPlans.map(p => [ 
    <span key="code" className="font-medium text-slate-700">{p.code}</span>,
    <div key="name" className="flex items-center gap-2">
      <Briefcase size={14} className="text-indigo-500" />
      <span>{p.name}</span>
    </div>,
    <span key="price_seat" className="font-semibold text-emerald-600">${p.price_per_seat}</span>,
    p.price_per_login ? <span key="price_login" className="text-slate-600">${p.price_per_login}</span> : <span className="text-slate-400">-</span>,
    <div key="currency" className="flex items-center gap-1 text-slate-500 text-sm">
      <Globe size={12} />
      {p.currency}
    </div>,
    <GlassButton key={p.id} size="sm" onClick={()=>{ subscribe(p.id) }}>Choose Plan</GlassButton> 
  ])

  return (
    <AppShell title="Billing Plans">
      <div className="space-y-6">
        
        {/* Top Section: Organization & Subscription */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Organization Selector */}
          <GlassCard className="lg:col-span-1 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Building2 size={120} className="text-indigo-500" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600">
                  <Building2 size={20} />
                </div>
                <h2 className="text-lg font-semibold text-slate-800">Organization</h2>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Organization</label>
                <div className="relative">
                  <select 
                    className="w-full pl-3 pr-10 py-2.5 bg-white/50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none"
                    value={orgId} 
                    onChange={e=>setOrgId(e.target.value)}
                  >
                    <option value="">Select an organization...</option>
                    {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <ChevronDown size={16} />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Manage billing and subscription plans for your selected organization.
                </p>
              </div>
            </div>
          </GlassCard>

          {/* Current Plan & Seats */}
          <GlassCard className="lg:col-span-2 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
              <CreditCard size={120} className="text-emerald-500" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                    <CreditCard size={20} />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-800">Current Subscription</h2>
                </div>
                <GlassButton href="/billing" size="sm" variant="ghost" className="text-indigo-600 hover:text-indigo-700">
                  <FileText size={14} className="mr-1" />
                  View Invoices
                </GlassButton>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Active Plan</label>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-bold text-slate-800">
                      {current?.plan?.code || 'Legacy / Manual'}
                    </div>
                    {current?.plan?.code && (
                      <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1">
                        <CheckCircle size={12} /> Active
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    {current?.plan?.name || 'No active plan selected'}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Seat Management</label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center bg-white/50 border border-slate-200 rounded-xl p-1">
                      <button 
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                        onClick={()=>{ const s = Math.max(0, Number(seats||0)-1); setSeats(String(s)); if(current?.plan) recalcPreview(current.plan, s) }}
                      >
                        <Minus size={16} />
                      </button>
                      <input 
                        className="w-16 text-center bg-transparent border-none text-slate-800 font-semibold focus:ring-0 p-0"
                        type="number" 
                        value={seats} 
                        onChange={e=>{ setSeats(e.target.value); if(current?.plan) recalcPreview(current.plan, Number(e.target.value||0)) }} 
                      />
                      <button 
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                        onClick={()=>{ const s = Number(seats||0)+1; setSeats(String(s)); if(current?.plan) recalcPreview(current.plan, s) }}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <GlassButton onClick={updateSeats} size="sm" variant="primary">
                      Update Seats
                    </GlassButton>
                  </div>
                </div>
              </div>

              {preview && (
                <div className="mt-6 p-4 rounded-xl bg-slate-900/5 border border-slate-200/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-emerald-100 text-emerald-600">
                      <DollarSign size={18} />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 font-medium uppercase">Estimated Monthly Cost</div>
                      <div className="text-xl font-bold text-emerald-600">
                        {preview.currency} ${Math.round(preview.monthly).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <GlassButton 
                    variant="primary" 
                    onClick={()=>{ if(current?.plan) subscribe(current.plan.id) }}
                    className="shadow-lg shadow-emerald-500/20"
                  >
                    Confirm Changes
                  </GlassButton>
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Bottom Section: Available Plans */}
        <GlassCard className="relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Briefcase size={120} className="text-blue-500" />
          </div>
          <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                <Briefcase size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Available Plans</h2>
                <p className="text-xs text-slate-500">Compare and choose the best plan for your team</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  className="w-full pl-10 pr-4 py-2 bg-white/50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  placeholder="Search plans..." 
                  value={search} 
                  onChange={e=>setSearch(e.target.value)} 
                />
              </div>
              <ExportMenu onExport={handleExport} isExporting={isExporting} />
            </div>
          </div>
          
          <div className="rounded-xl border border-slate-200/60 overflow-hidden">
            <GlassTable columns={columns} rows={rows} />
          </div>
          </div>
        </GlassCard>

      </div>
    </AppShell>
  )
}
