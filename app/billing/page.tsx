"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import ExportMenu from '@/components/shared/ExportMenu'
import { exportToCsv, exportToPdf, type ExportColumn } from '@/lib/export-utils'

function fmtCurrency(v: number, curr = 'USD') { try { return new Intl.NumberFormat(undefined, { style:'currency', currency: curr }).format(v) } catch { return `${curr} ${v.toFixed(2)}` } }

export default function BillingPage() {
  const [orgs, setOrgs] = useState<any[]>([])
  const [orgId, setOrgId] = useState('')
  const [invoices, setInvoices] = useState<any[]>([])
  const [org, setOrg] = useState<any | undefined>()
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store', headers:{ 'x-user-id':'admin' }}); const d = await res.json(); setOrgs(d.items||[]); if(!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadOrg = async (id: string) => { const res = await fetch(`/api/org/${id}`, { cache:'no-store' }); const d = await res.json(); setOrg(d.org) }
  const loadInvoices = async (id: string) => { const res = await fetch(`/api/billing/getInvoices?org_id=${id}`, { cache:'no-store', headers:{ 'x-user-id':'admin' }}); const d = await res.json(); setInvoices(d.items||[]) }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if(orgId) { loadOrg(orgId); loadInvoices(orgId) } }, [orgId])

  const columns = ['Invoice #','Date','Period','Subtotal','Tax','Total','Status','Action']
  const filteredInvoices = invoices.filter(inv => {
    const matchesStatus = statusFilter ? inv.status === statusFilter : true
    const q = search.trim().toLowerCase()
    if (!q) return matchesStatus
    const text = `${inv.invoiceNumber||''} ${inv.invoiceDate||''} ${inv.billingPeriodStart||''} ${inv.billingPeriodEnd||''}`.toLowerCase()
    return matchesStatus && text.includes(q)
  })

  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      const exportItems = filteredInvoices
      const exportColumns: ExportColumn[] = [
        { header: 'Invoice #', accessor: 'invoiceNumber' },
        { header: 'Date', accessor: 'invoiceDate' },
        { header: 'Period Start', accessor: 'billingPeriodStart' },
        { header: 'Period End', accessor: 'billingPeriodEnd' },
        { header: 'Subtotal', accessor: (inv) => fmtCurrency(inv.subtotal) },
        { header: 'Tax', accessor: (inv) => fmtCurrency(inv.tax) },
        { header: 'Total', accessor: (inv) => fmtCurrency(inv.total) },
        { header: 'Status', accessor: 'status' }
      ]
      
      const filename = `marq_billing_invoices_${new Date().toISOString().split('T')[0]}`

      if (type === 'csv') {
        await exportToCsv(exportItems, exportColumns, filename)
      } else {
        await exportToPdf(exportItems, exportColumns, 'Invoices', filename)
      }
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const rows = filteredInvoices.map(inv => [ inv.invoiceNumber, inv.invoiceDate, `${inv.billingPeriodStart} → ${inv.billingPeriodEnd}`, fmtCurrency(inv.subtotal), fmtCurrency(inv.tax), fmtCurrency(inv.total), inv.status, <GlassButton href={`/billing/${inv.id}`}>View</GlassButton> ])

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

      <GlassCard title="Invoices" right={<ExportMenu onExport={handleExport} isExporting={isExporting} />}>
        <div className="row" style={{marginBottom:12, gap:12}}>
          <div style={{flex:1,minWidth:180}}>
            <div className="label">Search</div>
            <input className="input" placeholder="Search by number or date" value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          <div style={{width:200}}>
            <div className="label">Status</div>
            <GlassSelect value={statusFilter} onChange={(e:any)=>setStatusFilter(e.target.value)}>
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="paid">Paid</option>
              <option value="void">Void</option>
            </GlassSelect>
          </div>
        </div>
        <GlassTable columns={columns} rows={rows} />
      </GlassCard>
    </AppShell>
  )
}

