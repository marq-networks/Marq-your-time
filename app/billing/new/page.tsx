"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassInput from '@components/ui/GlassInput'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'

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

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store', headers:{ 'x-user-id':'admin' }}); const d = await res.json(); setOrgs(d.items||[]); if(!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadUsers = async (oid: string) => { const res = await fetch(`/api/user/list?orgId=${oid}`, { cache:'no-store' }); const d = await res.json(); setUsers(d.items||[]); if(!userId && d.items?.length) setUserId(d.items[0].id) }

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
      <GlassCard title="Invoice Details">
        <div className="grid grid-3">
          <div>
            <div className="label">Organization</div>
            <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map((o:any)=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">User</div>
            <GlassSelect value={userId} onChange={(e:any)=>setUserId(e.target.value)}>
              <option value="">Select user</option>
              {users.map((u:any)=> <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">Invoice Date</div>
            <GlassInput type="date" value={invoiceDate} onChange={e=>setInvoiceDate(e.target.value)} />
          </div>
          <div>
            <div className="label">Billing Period Start</div>
            <GlassInput type="date" value={periodStart} onChange={e=>setPeriodStart(e.target.value)} />
          </div>
          <div>
            <div className="label">Billing Period End</div>
            <GlassInput type="date" value={periodEnd} onChange={e=>setPeriodEnd(e.target.value)} />
          </div>
          <div>
            <div className="label">Base Price</div>
            <GlassInput type="number" value={basePrice} onChange={e=>setBasePrice(e.target.value)} />
          </div>
          <div>
            <div className="label">Per-login Cost</div>
            <GlassInput type="number" value={perLogin} onChange={e=>setPerLogin(e.target.value)} />
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Line Items" right={<GlassButton onClick={addItem}>Add Item</GlassButton>}>
        {items.map((it,idx)=> (
          <div key={idx} className="grid grid-4" style={{marginBottom:8}}>
            <GlassInput value={it.title} onChange={e=>updateItem(idx,{ title:e.target.value })} />
            <GlassInput value={it.description||''} onChange={e=>updateItem(idx,{ description:e.target.value })} />
            <GlassInput type="number" value={String(it.quantity)} onChange={e=>updateItem(idx,{ quantity:Number(e.target.value) })} />
            <GlassInput type="number" value={String(it.unitPrice)} onChange={e=>updateItem(idx,{ unitPrice:Number(e.target.value) })} />
            <GlassButton variant="secondary" onClick={()=>removeItem(idx)}>Remove</GlassButton>
          </div>
        ))}
        <div className="row" style={{marginTop:12}}>
          <GlassButton onClick={submit}>Generate Invoice</GlassButton>
        </div>
      </GlassCard>
    </AppShell>
  )
}

