"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'

function fmtCurrency(v: number, curr = 'USD') { try { return new Intl.NumberFormat(undefined, { style:'currency', currency: curr }).format(v) } catch { return `${curr} ${v.toFixed(2)}` } }

export default function InvoicePage({ params }: { params: { invoiceId: string }}) {
  const [inv, setInv] = useState<any | undefined>()
  const [items, setItems] = useState<any[]>([])

  const load = async () => { const res = await fetch(`/api/billing/getInvoiceById?id=${params.invoiceId}`, { cache:'no-store', headers:{ 'x-user-id':'admin' }}); const d = await res.json(); setInv(d.invoice); setItems(d.lineItems||[]) }
  useEffect(()=>{ load() }, [])

  const markPaid = async () => { await fetch('/api/billing/markPaid', { method:'POST', headers:{ 'Content-Type':'application/json','x-user-id':'admin' }, body: JSON.stringify({ id: params.invoiceId }) }); load() }
  const sendInvoice = async () => {
    if (!inv) return
    const html = `<div><h2>Invoice ${inv.invoiceNumber}</h2><div>Date: ${inv.invoiceDate}</div><div>Org: ${inv.orgId}</div><div>Total: ${fmtCurrency(inv.total)}</div></div>`
    await fetch('/api/email/broadcast', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ subject: `Invoice ${inv.invoiceNumber}`, html }) })
  }

  const columns = ['Title','Description','Qty','Unit','Total']
  const rows = items.map(it => [ it.title, it.description || '', String(it.quantity), fmtCurrency(it.unitPrice), fmtCurrency(it.total) ])

  return (
    <AppShell title="Invoice">
      {inv && (
        <>
          <GlassCard title={`Invoice ${inv.invoiceNumber}`} right={<div className="row" style={{gap:8}}><GlassButton onClick={sendInvoice}>Send Invoice</GlassButton><GlassButton onClick={()=>window.print()}>Download PDF</GlassButton><GlassButton onClick={markPaid}>Mark Paid</GlassButton></div>}>
            <div className="grid grid-3">
              <div>
                <div className="label">Date</div>
                <div className="subtitle">{inv.invoiceDate}</div>
              </div>
              <div>
                <div className="label">Period</div>
                <div className="subtitle">{inv.billingPeriodStart} → {inv.billingPeriodEnd}</div>
              </div>
              <div>
                <div className="label">Status</div>
                <div className="subtitle">{inv.status}</div>
              </div>
            </div>
          </GlassCard>
          <GlassCard title="Line Items">
            <GlassTable columns={columns} rows={rows} />
          </GlassCard>
          <GlassCard title="Totals">
            <div className="grid grid-3">
              <div>
                <div className="label">Subtotal</div>
                <div className="subtitle">{fmtCurrency(inv.subtotal)}</div>
              </div>
              <div>
                <div className="label">Tax (10%)</div>
                <div className="subtitle">{fmtCurrency(inv.tax)}</div>
              </div>
              <div>
                <div className="label">Total</div>
                <div className="title">{fmtCurrency(inv.total)}</div>
              </div>
            </div>
          </GlassCard>
        </>
      )}
    </AppShell>
  )
}

