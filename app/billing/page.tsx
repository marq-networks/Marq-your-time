"use client"

import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import ExportMenu from '@/components/shared/ExportMenu'
import { exportToCsv, exportToPdf, type ExportColumn } from '@/lib/export-utils'
import { 
  FileText, 
  CreditCard, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Building2,
  Calendar,
  DollarSign,
  Briefcase
} from 'lucide-react'

function fmtCurrency(v: number, curr = 'USD') { 
  try { 
    return new Intl.NumberFormat(undefined, { style:'currency', currency: curr }).format(v) 
  } catch { 
    return `${curr} ${v.toFixed(2)}` 
  } 
}

export default function BillingPage() {
  const [orgs, setOrgs] = useState<any[]>([])
  const [orgId, setOrgId] = useState('')
  const [invoices, setInvoices] = useState<any[]>([])
  const [org, setOrg] = useState<any | undefined>()
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const loadOrgs = async () => { 
    try {
      const res = await fetch('/api/org/list', { cache:'no-store', headers:{ 'x-user-id':'admin' }})
      const d = await res.json()
      setOrgs(d.items||[])
      if(!orgId && d.items?.length) setOrgId(d.items[0].id)
    } catch (e) {
      console.error('Failed to load orgs', e)
    }
  }

  const loadOrg = async (id: string) => { 
    try {
      const res = await fetch(`/api/org/${id}`, { cache:'no-store' })
      const d = await res.json()
      setOrg(d.org)
    } catch (e) {
      console.error('Failed to load org', e)
    }
  }

  const loadInvoices = async (id: string) => { 
    try {
      const res = await fetch(`/api/billing/getInvoices?org_id=${id}`, { cache:'no-store', headers:{ 'x-user-id':'admin' }})
      const d = await res.json()
      setInvoices(d.items||[])
    } catch (e) {
      console.error('Failed to load invoices', e)
    }
  }

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

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid': return <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1 w-fit"><CheckCircle size={12} /> Paid</span>
      case 'open': return <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center gap-1 w-fit"><Clock size={12} /> Open</span>
      case 'void': return <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center gap-1 w-fit"><AlertCircle size={12} /> Void</span>
      default: return <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold flex items-center gap-1 w-fit">{status}</span>
    }
  }

  const rows = filteredInvoices.map(inv => [ 
    <span key="num" className="font-mono text-slate-700">{inv.invoiceNumber}</span>,
    <span key="date" className="text-slate-600">{inv.invoiceDate}</span>,
    <div key="period" className="text-xs text-slate-500">
      {inv.billingPeriodStart} <span className="text-slate-300">→</span> {inv.billingPeriodEnd}
    </div>,
    <span key="sub" className="text-slate-600">{fmtCurrency(inv.subtotal)}</span>,
    <span key="tax" className="text-slate-500 text-sm">{fmtCurrency(inv.tax)}</span>,
    <span key="total" className="font-semibold text-slate-800">{fmtCurrency(inv.total)}</span>,
    getStatusBadge(inv.status), 
    <GlassButton key="action" href={`/billing/${inv.id}`} size="sm" variant="ghost" className="text-indigo-600 hover:text-indigo-700">View</GlassButton> 
  ])

  return (
    <AppShell title="Billing">
      <div className="space-y-6">
        
        {/* Top Section: Subscription Summary */}
        <GlassCard className="relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <CreditCard size={120} className="text-indigo-500" />
          </div>
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Current Subscription</h2>
                  <p className="text-xs text-slate-500">Manage your plan and billing details</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <GlassButton href="/billing/new" size="sm" variant="primary" className="shadow-lg shadow-indigo-500/20">
                  <Plus size={16} className="mr-1" /> Generate New Invoice
                </GlassButton>
                <GlassButton href="/billing/settings" size="sm" variant="ghost">
                  <CreditCard size={16} className="mr-1" /> Payment Methods
                </GlassButton>
              </div>
            </div>

            {org ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                
                <div className="bg-white/40 p-3 rounded-xl border border-slate-100">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Subscription Plan</label>
                  <div className="flex items-center gap-2">
                    <Briefcase size={16} className="text-indigo-500" />
                    <span className="text-lg font-semibold text-slate-800">{org.subscriptionType}</span>
                  </div>
                </div>

                <div className="bg-white/40 p-3 rounded-xl border border-slate-100">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Price per Login</label>
                  <div className="flex items-center gap-2">
                    <DollarSign size={16} className="text-emerald-500" />
                    <span className="text-lg font-semibold text-slate-800">{fmtCurrency(org.pricePerLogin)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-24 text-slate-400">
                Loading organization details...
              </div>
            )}
          </div>
        </GlassCard>

        {/* Bottom Section: Invoices */}
        <GlassCard className="relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <FileText size={120} className="text-emerald-500" />
          </div>
          <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                <FileText size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Invoices</h2>
                <p className="text-xs text-slate-500">View and download your past invoices</p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  className="w-full pl-10 pr-4 py-2 bg-white/50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  placeholder="Search by number or date..." 
                  value={search} 
                  onChange={e=>setSearch(e.target.value)} 
                />
              </div>
              
              <div className="relative w-full sm:w-40">
                <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select 
                  className="w-full pl-10 pr-8 py-2 bg-white/50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none transition-all"
                  value={statusFilter} 
                  onChange={(e)=>setStatusFilter(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="open">Open</option>
                  <option value="paid">Paid</option>
                  <option value="void">Void</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <div className="w-2 h-2 border-r border-b border-current rotate-45 transform -translate-y-1/4"></div>
                </div>
              </div>

              <ExportMenu onExport={handleExport} isExporting={isExporting} />
            </div>
          </div>
          
          <div className="rounded-xl border border-slate-200/60 overflow-hidden">
            {filteredInvoices.length > 0 ? (
              <GlassTable columns={columns} rows={rows} />
            ) : (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText size={32} className="text-slate-400" />
                </div>
                <h3 className="text-slate-600 font-medium">No invoices found</h3>
                <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filters</p>
              </div>
            )}
          </div>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  )
}
