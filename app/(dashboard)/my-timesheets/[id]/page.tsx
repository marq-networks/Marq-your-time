'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'

export default function TimesheetDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const userId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_user_id='))?.split('=')[1] || '') : ''

  const loadData = async () => {
    if (!id) return
    setLoading(true)
    try {
      const r = await fetch(`/api/timesheets/detail?id=${id}`, { headers:{ 'x-user-id': userId } })
      const d = await r.json()
      setData(d)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const submitTimesheet = async () => {
    if (!confirm('Are you sure you want to submit this timesheet? You will not be able to edit it afterwards.')) return
    try {
      const r = await fetch('/api/timesheets/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ timesheetId: id })
      })
      const res = await r.json()
      if (res.error) alert(res.error)
      else {
        alert('Timesheet submitted successfully')
        loadData()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const refreshData = async () => {
    if (!confirm('This will re-calculate the timesheet based on current time logs. Any manual changes (if enabled) will be lost. Continue?')) return
    setLoading(true)
    try {
      const r = await fetch('/api/timesheets/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ timesheetId: id })
      })
      const res = await r.json()
      if (res.error) alert(res.error)
      else {
        await loadData()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ loadData() }, [id])

  if (loading || !data) return <AppShell title="Timesheet Detail">Loading...</AppShell>

  const { totals, items, status } = data
  const canSubmit = (status === 'draft' || status === 'changes_required') && data.employee_user_id === userId

  const itemRows = (items || []).map((it: any) => [
    it.date,
    `${Math.round(it.totals.worked_minutes / 60)}h ${it.totals.worked_minutes % 60}m`,
    `${it.totals.break_minutes}m`,
    // `${it.totals.idle_minutes}m` // If we had it in items
  ])

  return (
    <AppShell title={`Timesheet: ${data.period_start} - ${data.period_end}`}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <GlassButton onClick={()=>router.back()}>Back</GlassButton>
        {canSubmit && (
          <>
            <GlassButton onClick={refreshData}>Refresh Data</GlassButton>
            <GlassButton variant="primary" onClick={submitTimesheet}>Submit for Approval</GlassButton>
          </>
        )}
      </div>

      <div className="grid-2">
        <GlassCard title="Overview">
           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
             <div>Status: <strong>{status.toUpperCase()}</strong></div>
             {data.rejection_reason && <div style={{ color: 'red' }}>Reason: {data.rejection_reason}</div>}
             <div>Worked: {Math.round(totals.worked_minutes/60)}h {totals.worked_minutes%60}m</div>
             <div>Breaks: {totals.break_minutes}m</div>
             <div>Overtime: {totals.overtime_minutes}m</div>
             <div>Idle: {totals.idle_minutes}m</div>
             <div>Activity: {totals.activity_percent}%</div>
             <div>Screenshots: {totals.screenshots_count}</div>
           </div>
        </GlassCard>
      </div>

      <div style={{ marginTop: 16 }}>
        <GlassCard title="Daily Breakdown">
          <GlassTable columns={['Date', 'Worked', 'Breaks']} rows={itemRows} />
        </GlassCard>
      </div>
    </AppShell>
  )
}
