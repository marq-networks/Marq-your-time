'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import ExportMenu from '@/components/shared/ExportMenu'
import { exportToCsv, exportToPdf, ExportColumn } from '@/lib/export-utils'

export default function MyTimesheetsPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const router = useRouter()
  
  const userId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_user_id='))?.split('=')[1] || '') : ''
  const orgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''

  const handleExport = async (type: 'csv' | 'pdf') => {
    if (!orgId) return
    setIsExporting(true)
    try {
      const exportItems = items
      const exportColumns: ExportColumn[] = [
        { header: 'Period Start', accessor: 'period_start' },
        { header: 'Period End', accessor: 'period_end' },
        { header: 'Status', accessor: (i) => i.status.toUpperCase() },
        { header: 'Worked', accessor: (it) => `${Math.round(it.totals.worked_minutes / 60)}h ${it.totals.worked_minutes % 60}m` },
      ]
      const filename = `marq_my_timesheets_${new Date().toISOString().split('T')[0]}`
      if (type === 'csv') exportToCsv(exportItems, exportColumns, filename)
      else exportToPdf(exportItems, exportColumns, 'My Timesheets', filename)
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const loadItems = async () => {
    if (!userId || !orgId) return
    setLoading(true)
    try {
      const r = await fetch(`/api/timesheets/list?org_id=${orgId}&employee_user_id=${userId}`, { cache:'no-store', headers:{ 'x-user-id': userId } })
      const d = await r.json()
      setItems(d.items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const createCurrentWeek = async () => {
    // Calculate current week start (Monday) and end (Sunday)
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
    const monday = new Date(now.setDate(diff))
    const sunday = new Date(now.setDate(diff + 6))
    
    const start = monday.toISOString().split('T')[0]
    const end = sunday.toISOString().split('T')[0]

    try {
      const r = await fetch('/api/timesheets/create-or-get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({
          orgId,
          employeeUserId: userId,
          periodType: 'week',
          periodStart: start,
          periodEnd: end
        })
      })
      const data = await r.json()
      if (data.id) {
        router.push(`/my-timesheets/${data.id}`)
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(()=>{ loadItems() }, [userId, orgId])

  const rows = items.map((it: any) => [
    it.period_start + ' to ' + it.period_end,
    it.status.toUpperCase(),
    `${Math.round(it.totals.worked_minutes / 60)}h ${it.totals.worked_minutes % 60}m`,
    <GlassButton onClick={()=>router.push(`/my-timesheets/${it.id}`)}>View</GlassButton>
  ])

  return (
    <AppShell title="My Timesheets">
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginBottom: 16 }}>
        <ExportMenu isExporting={isExporting} onExport={handleExport} />
        <GlassButton variant="primary" onClick={createCurrentWeek}>Generate Current Week</GlassButton>
      </div>
      <GlassCard title="History">
        {loading ? <div>Loading...</div> : <GlassTable columns={[ 'Period', 'Status', 'Worked', 'Action' ]} rows={rows} />}
      </GlassCard>
    </AppShell>
  )
}
