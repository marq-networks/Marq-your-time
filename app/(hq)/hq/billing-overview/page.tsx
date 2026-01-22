'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import ExportMenu from '@components/shared/ExportMenu'
import { exportToCsv, exportToPdf, type ExportColumn } from '@lib/export-utils'

export default function HQBillingOverview() {
  const [forbidden, setForbidden] = useState(false)
  const [data, setData] = useState<any>({ mrr:0, arr:0, churn_rate:0, orgs:[] })
  const [isExporting, setIsExporting] = useState(false)
  
  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      const exportItems = data.orgs || []
      const exportColumns: ExportColumn[] = [
        { header: 'Organization', accessor: 'org_name' },
        { header: 'Plan', accessor: 'plan_code' },
        { header: 'Seats', accessor: (o) => String(o.seats || 0) },
        { header: 'MRR', accessor: (o) => `$${Math.round(o.mrr || 0).toLocaleString()}` },
        { header: 'ARR', accessor: (o) => `$${Math.round(o.arr || 0).toLocaleString()}` },
      ]
      
      const filename = `hq_billing_${new Date().toISOString().split('T')[0]}`

      if (type === 'csv') {
        await exportToCsv(exportItems, exportColumns, filename)
      } else {
        await exportToPdf(exportItems, exportColumns, 'HQ Billing Overview', filename)
      }
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const load = async () => {
    const hdr = { 'x-role': 'super_admin' }
    const res = await fetch('/api/hq/billing-overview', { headers: hdr, cache:'no-store' })
    if (res.status === 403) { setForbidden(true); return }
    const d = await res.json()
    setData(d)
  }

  useEffect(()=>{ load() }, [])

  if (forbidden) {
    return (
      <AppShell title="HQ Billing Overview">
        <div style={{display:'grid',placeItems:'center',height:'60vh'}}>
          <div className="glass-panel" style={{padding:24,borderRadius:'var(--radius-large)'}}>
            <div className="title">Access Denied</div>
            <div className="subtitle">You must be a Super Admin to view this page.</div>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="HQ Billing Overview">
      <div className="grid-3">
        <div className="glass-panel" style={{padding:20,borderRadius:28}}>
          <div className="card-title">Global MRR</div>
          <div className="title">${Math.round(data.mrr||0).toLocaleString()}</div>
        </div>
        <div className="glass-panel" style={{padding:20,borderRadius:28}}>
          <div className="card-title">Global ARR</div>
          <div className="title">${Math.round(data.arr||0).toLocaleString()}</div>
        </div>
        <div className="glass-panel" style={{padding:20,borderRadius:28}}>
          <div className="card-title">Churn (30d)</div>
          <div className="title">{Math.round((data.churn_rate||0)*100)}%</div>
        </div>
      </div>

      <GlassCard title="Organizations by Plan and Revenue" right={<ExportMenu onExport={handleExport} isExporting={isExporting} />}>
        <GlassTable columns={["Organization","Plan","Seats","MRR","ARR"]} rows={(data.orgs||[]).map((o:any)=>[
          o.org_name,
          o.plan_code,
          String(o.seats||0),
          `$${Math.round(o.mrr||0).toLocaleString()}`,
          `$${Math.round(o.arr||0).toLocaleString()}`
        ])} />
      </GlassCard>
    </AppShell>
  )
}

