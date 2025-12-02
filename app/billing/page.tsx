"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'

function fmtCurrency(v: number, curr = 'USD') { try { return new Intl.NumberFormat(undefined, { style:'currency', currency: curr }).format(v) } catch { return `${curr} ${v.toFixed(2)}` } }

export default function BillingPage() {
  const [orgs, setOrgs] = useState<any[]>([])
  const [orgId, setOrgId] = useState('')
  const [invoices, setInvoices] = useState<any[]>([])
  const [org, setOrg] = useState<any | undefined>()

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store', headers:{ 'x-user-id':'admin' }}); const d = await res.json(); setOrgs(d.items||[]); if(!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadOrg = async (id: string) => { const res = await fetch(`/api/org/${id}`, { cache:'no-store' }); const d = await res.json(); setOrg(d.org) }
  const loadInvoices = async (id: string) => { const res = await fetch(`/api/billing/getInvoices?org_id=${id}`, { cache:'no-store', headers:{ 'x-user-id':'admin' }}); const d = await res.json(); setInvoices(d.items||[]) }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId) { loadOrg(orgId); loadInvoices(orgId) } }, [orgId])

  const columns = ['Invoice #','Date','Period','Subtotal','Tax','Total','Status','Action']
  const rows = invoices.map(inv => [ inv.invoiceNumber, inv.invoiceDate, `${inv.billingPeriodStart} → ${inv.billingPeriodEnd}`, fmtCurrency(inv.subtotal), fmtCurrency(inv.tax), fmtCurrency(inv.total), inv.status, <GlassButton href={`/billing/${inv.id}`}>View</GlassButton> ])

  return (
    <AppShell title="Billing">
      <GlassCard title="Current Subscription" right={<div className="row" style={{gap:8}}><GlassButton href="/billing/new">Generate New Invoice</GlassButton><GlassButton href="/billing/settings">Add Payment Method</GlassButton></div>}>
        {org && (
          <div className="grid grid-3">
            <div>
              <div className="label">Organization</div>
              <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
                <option value="">Select org</option>
                {orgs.map((o:any)=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
              </GlassSelect>
            </div>
            <div>
              <div className="label">Subscription</div>
              <div className="subtitle">{org.subscriptionType}</div>
            </div>
            <div>
              <div className="label">Price per Login</div>
              <div className="subtitle">{fmtCurrency(org.pricePerLogin)}</div>
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard title="Invoices">
        <GlassTable columns={columns} rows={rows} />
      </GlassCard>
    </AppShell>
  )
}

