"use client"

import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import ExportMenu from '@components/shared/ExportMenu'
import { ExportColumn, exportToCsv, exportToPdf } from '@lib/export-utils'
import { 
  Printer, 
  Send, 
  CheckCircle, 
  Download, 
  FileText, 
  Calendar, 
  DollarSign, 
  Clock, 
  AlertCircle,
  Hash,
  Briefcase
} from 'lucide-react'

function fmtCurrency(v: number, curr = 'USD') { 
  try { 
    return new Intl.NumberFormat(undefined, { style:'currency', currency: curr }).format(v) 
  } catch { 
    return `${curr} ${v.toFixed(2)}` 
  } 
}

export default function InvoicePage({ params }: { params: { invoiceId: string }}) {
  const [inv, setInv] = useState<any | undefined>()
  const [items, setItems] = useState<any[]>([])
  const [isExporting, setIsExporting] = useState(false)

  const load = async () => { 
    try {
      const res = await fetch(`/api/billing/getInvoiceById?id=${params.invoiceId}`, { cache:'no-store', headers:{ 'x-user-id':'admin' }})
      const d = await res.json()
      setInv(d.invoice)
      setItems(d.lineItems||[])
    } catch (e) {
      console.error('Failed to load invoice', e)
    }
  }

  useEffect(()=>{ load() }, [])

  const markPaid = async () => { 
    try {
      await fetch('/api/billing/markPaid', { method:'POST', headers:{ 'Content-Type':'application/json','x-user-id':'admin' }, body: JSON.stringify({ id: params.invoiceId }) })
      load() 
    } catch (e) {
      console.error('Failed to mark paid', e)
    }
  }

  const sendInvoice = async () => {
    if (!inv) return
    const html = `<div><h2>Invoice ${inv.invoiceNumber}</h2><div>Date: ${inv.invoiceDate}</div><div>Org: ${inv.orgId}</div><div>Total: ${fmtCurrency(inv.total)}</div></div>`
    try {
      await fetch('/api/email/broadcast', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ subject: `Invoice ${inv.invoiceNumber}`, html }) })
      alert('Invoice sent successfully')
    } catch (e) {
      console.error('Failed to send invoice', e)
      alert('Failed to send invoice')
    }
  }

  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      if (items.length === 0) {
        alert('No data to export')
        return
      }
      const exportColumns: ExportColumn[] = [
        { header: 'Title', accessor: 'title' },
        { header: 'Description', accessor: (it) => it.description || '' },
        { header: 'Quantity', accessor: 'quantity' },
        { header: 'Unit Price', accessor: (it) => fmtCurrency(it.unitPrice) },
        { header: 'Total', accessor: (it) => fmtCurrency(it.total) }
      ]
      const filename = `marq_invoice_${inv?.invoiceNumber || params.invoiceId}_${new Date().toISOString().split('T')[0]}`
      if (type === 'csv') {
        await exportToCsv(items, exportColumns, filename)
      } else {
        await exportToPdf(items, exportColumns, `Invoice ${inv?.invoiceNumber}`, filename)
      }
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid': return <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-semibold flex items-center gap-1 w-fit"><CheckCircle size={14} /> Paid</span>
      case 'open': return <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex items-center gap-1 w-fit"><Clock size={14} /> Open</span>
      case 'void': return <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-sm font-semibold flex items-center gap-1 w-fit"><AlertCircle size={14} /> Void</span>
      default: return <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-sm font-semibold flex items-center gap-1 w-fit">{status}</span>
    }
  }

  const columns = ['Title','Description','Qty','Unit','Total']
  const rows = items.map(it => [ 
    <span key="title" className="font-medium text-slate-700">{it.title}</span>,
    <span key="desc" className="text-slate-500">{it.description || ''}</span>,
    <span key="qty" className="font-mono text-slate-600">{it.quantity}</span>,
    <span key="unit" className="text-slate-600">{fmtCurrency(it.unitPrice)}</span>,
    <span key="total" className="font-semibold text-slate-800">{fmtCurrency(it.total)}</span> 
  ])

  return (
    <AppShell title="Invoice Details">
      {inv ? (
        <div className="space-y-6">
          <GlassCard className="relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <FileText size={150} className="text-slate-900" />
            </div>
            
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-slate-100 text-slate-600 border border-slate-200">
                    <FileText size={32} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-2xl font-bold text-slate-800">Invoice {inv.invoiceNumber}</h2>
                      {getStatusBadge(inv.status)}
                    </div>
                    <p className="text-sm text-slate-500 flex items-center gap-2">
                      <Calendar size={14} /> Issued on {inv.invoiceDate}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <ExportMenu onExport={handleExport} isExporting={isExporting} />
                  <GlassButton onClick={sendInvoice} size="sm" variant="ghost">
                    <Send size={16} className="mr-2" /> Send
                  </GlassButton>
                  <GlassButton onClick={()=>window.print()} size="sm" variant="ghost">
                    <Printer size={16} className="mr-2" /> Print
                  </GlassButton>
                  {inv.status !== 'paid' && (
                    <GlassButton onClick={markPaid} size="sm" variant="primary" className="shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 text-white border-transparent">
                      <CheckCircle size={16} className="mr-2" /> Mark Paid
                    </GlassButton>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white/40 p-6 rounded-2xl border border-slate-100">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Billing Period</label>
                  <div className="flex items-center gap-2 text-slate-700 font-medium">
                    <Calendar size={16} className="text-indigo-500" />
                    {inv.billingPeriodStart} <span className="text-slate-300">→</span> {inv.billingPeriodEnd}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Organization ID</label>
                  <div className="flex items-center gap-2 text-slate-700 font-medium">
                    <Briefcase size={16} className="text-indigo-500" />
                    {inv.orgId}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Total Amount</label>
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
                    <DollarSign size={20} className="text-emerald-500" />
                    {fmtCurrency(inv.total)}
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Hash size={120} className="text-slate-400" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                  <Hash size={20} />
                </div>
                <h2 className="text-lg font-semibold text-slate-800">Line Items</h2>
              </div>
              <div className="rounded-xl border border-slate-200/60 overflow-hidden">
                <GlassTable columns={columns} rows={rows} />
              </div>
            </div>
          </GlassCard>

          <div className="flex justify-end">
            <GlassCard className="w-full md:w-1/3 !p-0 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <DollarSign size={80} className="text-emerald-500" />
              </div>
              <div className="bg-slate-50/80 p-4 border-b border-slate-100 relative z-10">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  <DollarSign size={16} className="text-emerald-500" />
                  Invoice Summary
                </h3>
              </div>
              <div className="p-6 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-medium text-slate-700">{fmtCurrency(inv.subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Tax (10%)</span>
                  <span className="font-medium text-slate-700">{fmtCurrency(inv.tax)}</span>
                </div>
                <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                  <span className="font-bold text-slate-800">Total</span>
                  <span className="font-bold text-xl text-indigo-600">{fmtCurrency(inv.total)}</span>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-[50vh]">
          <div className="text-center">
             <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <FileText size={32} className="text-indigo-300" />
             </div>
             <p className="text-slate-400">Loading invoice details...</p>
          </div>
        </div>
      )}
    </AppShell>
  )
}
