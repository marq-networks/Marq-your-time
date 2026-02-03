'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import ExportMenu from '@/components/shared/ExportMenu'
import { exportToCsv, exportToPdf, ExportColumn } from '@/lib/export-utils'

function getCookie(name: string) {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))
  return m ? decodeURIComponent(m.split('=').slice(1).join('=')) : ''
}

export default function MyTimesheetsPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [stats, setStats] = useState({ totalWorked: 0, pending: 0, approved: 0 })
  const router = useRouter()
  
  const [userId, setUserId] = useState('')
  const [orgId, setOrgId] = useState('')

  useEffect(() => {
    setUserId(getCookie('current_user_id'))
    setOrgId(getCookie('current_org_id'))
  }, [])

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
    if (!userId || !orgId) {
        if (userId && !orgId) {
             // Try to find org? For now just stop loading
             console.warn("Org ID missing")
        }
        setLoading(false)
        return
    }
    setLoading(true)
    try {
      const r = await fetch(`/api/timesheets/list?org_id=${orgId}&employee_user_id=${userId}`, { cache:'no-store', headers:{ 'x-user-id': userId } })
      const d = await r.json()
      const list = d.items || []
      setItems(list)
      
      // Calculate stats
      let worked = 0
      let pend = 0
      let app = 0
      list.forEach((i: any) => {
          worked += (i.totals?.worked_minutes || 0)
          if (i.status === 'pending') pend++
          if (i.status === 'approved') app++
      })
      setStats({ totalWorked: worked, pending: pend, approved: app })

    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const createCurrentWeek = async () => {
    if (!userId || !orgId) return alert('Missing user or organization context')
    
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
      } else {
        alert('Failed to create timesheet: ' + (data.error || 'Unknown error'))
      }
    } catch (e) {
      console.error(e)
      alert('Error creating timesheet')
    }
  }

  useEffect(()=>{ 
      if (userId && orgId) loadItems() 
      else if (typeof document !== 'undefined') {
          // Initial check failed, but maybe we just need to wait for hydration? 
          // userId and orgId are state now, so this effect runs when they change.
          // If they stay empty after mount, we stop loading.
          const t = setTimeout(() => setLoading(false), 1000)
          return () => clearTimeout(t)
      }
  }, [userId, orgId])

  const rows = items.map((it: any) => [
    <div key={it.id} className="font-medium text-slate-700">{it.period_start} <span className="text-slate-400 mx-1">→</span> {it.period_end}</div>,
    <span key={it.id} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        it.status === 'approved' ? 'bg-green-100 text-green-800' :
        it.status === 'rejected' ? 'bg-red-100 text-red-800' :
        'bg-yellow-100 text-yellow-800'
    }`}>
        {it.status.charAt(0).toUpperCase() + it.status.slice(1)}
    </span>,
    <div key={it.id} className="font-mono text-sm text-slate-600">
        {Math.floor(it.totals.worked_minutes / 60)}h {(it.totals.worked_minutes % 60).toString().padStart(2, '0')}m
    </div>,
    <button key={it.id} onClick={()=>router.push(`/my-timesheets/${it.id}`)} className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">
        View Details
    </button>
  ])

  return (
    <AppShell title="My Timesheets">
      <div className="space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <div className="bg-white/60 backdrop-blur-md border border-white/20 rounded-2xl p-4 shadow-sm">
              <div className="text-sm text-slate-500 font-medium mb-1">Total Worked (All Time)</div>
              <div className="text-2xl font-bold text-slate-800">
                  {Math.floor(stats.totalWorked / 60)}<span className="text-sm font-normal text-slate-500 ml-1">h</span> {stats.totalWorked % 60}<span className="text-sm font-normal text-slate-500 ml-1">m</span>
              </div>
           </div>
           <div className="bg-white/60 backdrop-blur-md border border-white/20 rounded-2xl p-4 shadow-sm">
              <div className="text-sm text-slate-500 font-medium mb-1">Pending Approval</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
           </div>
           <div className="bg-white/60 backdrop-blur-md border border-white/20 rounded-2xl p-4 shadow-sm">
              <div className="text-sm text-slate-500 font-medium mb-1">Approved</div>
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
           </div>
           <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-4 shadow-lg text-white flex flex-col justify-between relative overflow-hidden group cursor-pointer" onClick={createCurrentWeek}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8 group-hover:scale-110 transition-transform"></div>
              <div className="relative z-10">
                  <div className="text-blue-100 text-sm font-medium mb-1">Current Week</div>
                  <div className="text-lg font-bold">Generate Timesheet</div>
              </div>
              <div className="relative z-10 self-end mt-2">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </div>
           </div>
        </div>

        <div className="flex justify-between items-center pt-4">
            <h2 className="text-lg font-semibold text-slate-800">History</h2>
            <div className="flex items-center gap-3">
                 <ExportMenu isExporting={isExporting} onExport={handleExport} />
            </div>
        </div>

        <GlassCard>
            {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3"></div>
                    <div className="text-sm">Loading timesheets...</div>
                </div>
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <svg className="w-12 h-12 mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                    <div className="text-sm font-medium text-slate-500">No timesheets found</div>
                    <p className="text-xs text-slate-400 mt-1">Generate a timesheet for the current week to get started.</p>
                </div>
            ) : (
                <GlassTable 
                    columns={[ 'Period', 'Status', 'Worked', 'Action' ]} 
                    rows={rows} 
                />
            )}
        </GlassCard>
      </div>
    </AppShell>
  )
}
