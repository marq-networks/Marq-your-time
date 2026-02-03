"use client"

import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import { 
  User, 
  Calendar, 
  Building2, 
  CreditCard, 
  Plus, 
  Trash2, 
  Save, 
  FileText, 
  DollarSign,
  AlignLeft,
  Hash
} from 'lucide-react'

type Item = { title: string, description?: string, quantity: number, unitPrice: number }

export default function NewInvoicePage() {
  const [orgs, setOrgs] = useState<any[]>([])
  const [orgId, setOrgId] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [userId, setUserId] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(()=> new Date().toISOString().slice(0,10))
  const [periodStart, setPeriodStart] = useState(()=> new Date().toISOString().slice(0,10))
  const [periodEnd, setPeriodEnd] = useState(()=> new Date().toISOString().slice(0,10))
  const [basePrice, setBasePrice] = useState('0')
  const [perLogin, setPerLogin] = useState('0')
  const [items, setItems] = useState<Item[]>([])

  const loadOrgs = async () => { 
    const res = await fetch('/api/org/list', { cache:'no-store', headers:{ 'x-user-id':'admin' }})
    const d = await res.json()
    setOrgs(d.items||[])
    if(!orgId && d.items?.length) setOrgId(d.items[0].id)
  }
  
  const loadUsers = async (oid: string) => { 
    const res = await fetch(`/api/user/list?orgId=${oid}`, { cache:'no-store' })
    const d = await res.json()
    setUsers(d.items||[])
    if(!userId && d.items?.length) setUserId(d.items[0].id)
  }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId) loadUsers(orgId) }, [orgId])

  const addItem = () => setItems(items.concat({ title:'Item', description:'', quantity:1, unitPrice:0 }))
  const removeItem = (idx: number) => setItems(items.filter((_,i)=>i!==idx))
  const updateItem = (idx:number, patch: Partial<Item>) => setItems(items.map((it,i)=> i===idx ? { ...it, ...patch } : it))

  const submit = async () => {
    const body = { orgId, invoiceDate, billingPeriodStart: periodStart, billingPeriodEnd: periodEnd, basePrice: Number(basePrice), perLoginCost: Number(perLogin), items }
    const res = await fetch('/api/billing/createInvoice', { method:'POST', headers:{ 'Content-Type':'application/json','x-user-id':'admin' }, body: JSON.stringify(body) })
    const d = await res.json()
    if (d.id) window.location.href = `/billing/${d.id}`
  }

  return (
    <AppShell title="Generate Invoice">
      <div className="space-y-6">
        
        <GlassCard className="relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <FileText size={120} className="text-indigo-500" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600">
                <FileText size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Invoice Details</h2>
                <p className="text-xs text-slate-500">Enter the basic information for this invoice</p>
              </div>
            </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Organization */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Organization</label>
              <div className="relative">
                <select 
                  className="w-full pl-3 pr-10 py-2.5 bg-white/50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none transition-all"
                  value={orgId} 
                  onChange={(e)=>setOrgId(e.target.value)}
                >
                  <option value="">Select org</option>
                  {orgs.map((o:any)=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <Building2 size={16} />
                </div>
              </div>
            </div>

            {/* User */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">User</label>
              <div className="relative">
                <select 
                  className="w-full pl-3 pr-10 py-2.5 bg-white/50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none transition-all"
                  value={userId} 
                  onChange={(e)=>setUserId(e.target.value)}
                >
                  <option value="">Select user</option>
                  {users.map((u:any)=> <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <User size={16} />
                </div>
              </div>
            </div>

            {/* Invoice Date */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Invoice Date</label>
              <div className="relative">
                <input 
                  type="date"
                  className="w-full pl-3 pr-10 py-2.5 bg-white/50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  value={invoiceDate} 
                  onChange={e=>setInvoiceDate(e.target.value)} 
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <Calendar size={16} />
                </div>
              </div>
            </div>

            {/* Period Start */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Billing Period Start</label>
              <div className="relative">
                <input 
                  type="date"
                  className="w-full pl-3 pr-10 py-2.5 bg-white/50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  value={periodStart} 
                  onChange={e=>setPeriodStart(e.target.value)} 
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <Calendar size={16} />
                </div>
              </div>
            </div>

            {/* Period End */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Billing Period End</label>
              <div className="relative">
                <input 
                  type="date"
                  className="w-full pl-3 pr-10 py-2.5 bg-white/50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  value={periodEnd} 
                  onChange={e=>setPeriodEnd(e.target.value)} 
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <Calendar size={16} />
                </div>
              </div>
            </div>

            {/* Base Price */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Base Price</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <DollarSign size={16} />
                </div>
                <input 
                  type="number"
                  className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  value={basePrice} 
                  onChange={e=>setBasePrice(e.target.value)} 
                />
              </div>
            </div>

            {/* Per Login Cost */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Per-login Cost</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <DollarSign size={16} />
                </div>
                <input 
                  type="number"
                  className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  value={perLogin} 
                  onChange={e=>setPerLogin(e.target.value)} 
                />
              </div>
            </div>
          </div>
          </div>
        </GlassCard>

        <GlassCard className="relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <AlignLeft size={120} className="text-emerald-500" />
          </div>
          <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                <AlignLeft size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Line Items</h2>
                <p className="text-xs text-slate-500">Add detailed items to the invoice</p>
              </div>
            </div>
            <GlassButton onClick={addItem} size="sm" variant="secondary">
              <Plus size={16} className="mr-1" /> Add Item
            </GlassButton>
          </div>

          <div className="space-y-3">
            {items.map((it,idx)=> (
              <div key={idx} className="grid grid-cols-12 gap-3 p-3 rounded-xl bg-slate-50/50 border border-slate-100 hover:border-indigo-100 hover:shadow-sm transition-all items-end">
                <div className="col-span-12 md:col-span-3">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Title</label>
                  <input 
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Item title"
                    value={it.title} 
                    onChange={e=>updateItem(idx,{ title:e.target.value })} 
                  />
                </div>
                <div className="col-span-12 md:col-span-4">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Description</label>
                  <input 
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Description (optional)"
                    value={it.description||''} 
                    onChange={e=>updateItem(idx,{ description:e.target.value })} 
                  />
                </div>
                <div className="col-span-6 md:col-span-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Qty</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      className="w-full pl-8 pr-2 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      value={String(it.quantity)} 
                      onChange={e=>updateItem(idx,{ quantity:Number(e.target.value) })} 
                    />
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <Hash size={14} />
                    </div>
                  </div>
                </div>
                <div className="col-span-6 md:col-span-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Unit Price</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      className="w-full pl-8 pr-2 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      value={String(it.unitPrice)} 
                      onChange={e=>updateItem(idx,{ unitPrice:Number(e.target.value) })} 
                    />
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <DollarSign size={14} />
                    </div>
                  </div>
                </div>
                <div className="col-span-12 md:col-span-1 flex justify-end">
                   <button 
                    onClick={()=>removeItem(idx)}
                    className="p-2.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 transition-colors"
                    title="Remove Item"
                   >
                     <Trash2 size={18} />
                   </button>
                </div>
              </div>
            ))}
            
            {items.length === 0 && (
              <div className="text-center py-8 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <div className="text-slate-400 mb-2">No line items added</div>
                <GlassButton onClick={addItem} size="sm" variant="ghost">Add your first item</GlassButton>
              </div>
            )}
          </div>
          
          <div className="flex justify-end mt-8 pt-6 border-t border-slate-200/50">
            <GlassButton onClick={submit} size="lg" variant="primary" className="shadow-lg shadow-indigo-500/20">
              <Save size={18} className="mr-2" />
              Generate Invoice
            </GlassButton>
          </div>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  )
}
