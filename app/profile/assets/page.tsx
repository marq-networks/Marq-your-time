"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import ExportMenu from '@components/shared/ExportMenu'
import { ExportColumn, exportToCsv, exportToPdf } from '@lib/export-utils'

type Item = { asset_tag: string, category: string, model?: string | null, assigned_at: string }

export default function MyAssetsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [memberId, setMemberId] = useState<string>('demo-user')
  const [isExporting, setIsExporting] = useState(false)

  const load = async () => {
    if (!memberId) return setItems([])
    const r = await fetch(`/api/assets/member?member_id=${memberId}`, { cache:'no-store', headers:{ 'x-user-id': memberId } })
    const d = await r.json()
    setItems(d.items||[])
  }

  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      if (items.length === 0) {
        alert('No data to export')
        return
      }
      const exportColumns: ExportColumn[] = [
        { header: 'Asset Tag', accessor: 'asset_tag' },
        { header: 'Category', accessor: 'category' },
        { header: 'Model', accessor: (item) => item.model || '' },
        { header: 'Assigned Date', accessor: (item) => new Date(item.assigned_at).toLocaleDateString() }
      ]
      const filename = `my_assets_${new Date().toISOString().split('T')[0]}`
      if (type === 'csv') {
        await exportToCsv(items, exportColumns, filename)
      } else {
        await exportToPdf(items, exportColumns, 'My Assets', filename)
      }
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  useEffect(()=>{ load() }, [memberId])

  return (
    <AppShell title="My Assets">
      <div className="col" style={{ gap: 16 }}>
        <GlassCard title="Assigned Assets" right={<div className="row" style={{gap:8}}>
          <ExportMenu onExport={handleExport} isExporting={isExporting} />
          <input className="input" value={memberId} onChange={e=> setMemberId(e.target.value)} placeholder="Member ID" />
          <GlassButton variant="secondary" onClick={load}>Refresh</GlassButton>
        </div>}>
          <div className="grid-1" style={{ gap: 12 }}>
            {items.map((it,i)=> (
              <div key={`${it.asset_tag}-${i}`} className="glass-panel" style={{ padding: 12, borderRadius: 16 }}>
                <div className="row" style={{ gap: 12, alignItems:'center' }}>
                  <span className="tag-pill accent">{it.asset_tag}</span>
                  <span className="badge">{it.category}</span>
                  <span className="subtitle">{it.model || ''}</span>
                  <span className="subtitle">Assigned {new Date(it.assigned_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {!items.length && <div className="subtitle">No assets assigned.</div>}
          </div>
        </GlassCard>
      </div>
    </AppShell>
  )
}

