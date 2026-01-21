'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'

export default function TimesheetReviewPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState('')

  const userId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_user_id='))?.split('=')[1] || '') : ''
  const role = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''

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

  const review = async (action: 'approve' | 'reject' | 'changes_required') => {
    if (action !== 'approve' && !reason.trim()) {
      alert('Reason is required for rejection or requesting changes')
      return
    }
    if (!confirm(`Are you sure you want to ${action} this timesheet?`)) return

    try {
      const r = await fetch('/api/timesheets/review', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'x-user-id': userId,
            'x-role': role 
        },
        body: JSON.stringify({ timesheetId: id, action, reason })
      })
      const res = await r.json()
      if (res.error) alert(res.error)
      else {
        alert('Timesheet updated successfully')
        router.push('/timesheets/approvals')
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(()=>{ loadData() }, [id])

  if (loading || !data) return <AppShell title="Review Timesheet">Loading...</AppShell>

  const { totals, items, status, employees } = data
  const employeeName = employees ? `${employees.first_name} ${employees.last_name}` : 'Unknown'

  const itemRows = (items || []).map((it: any) => [
    it.date,
    `${Math.round(it.totals.worked_minutes / 60)}h ${it.totals.worked_minutes % 60}m`,
    `${it.totals.break_minutes}m`
  ])

  // Anomaly Detection Logic
  const anomalies = []
  if (totals.idle_minutes > 60) anomalies.push(`High Idle Time: ${totals.idle_minutes} minutes`)
  if (totals.activity_percent < 30) anomalies.push(`Low Activity: ${totals.activity_percent}%`)
  if (totals.screenshots_count === 0 && totals.worked_minutes > 60) anomalies.push('No Screenshots recorded for >1h work')
  if (totals.overtime_minutes > 120) anomalies.push(`High Overtime: ${totals.overtime_minutes} minutes`)

  return (
    <AppShell title={`Review: ${employeeName} (${data.period_start} - ${data.period_end})`}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <GlassButton onClick={()=>router.back()}>Back</GlassButton>
      </div>

      <div className="grid-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <GlassCard title="Overview">
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
               <div>Status: <strong>{status.toUpperCase()}</strong></div>
               <div>Worked: {Math.round(totals.worked_minutes/60)}h {totals.worked_minutes%60}m</div>
               <div>Breaks: {totals.break_minutes}m</div>
               <div>Overtime: {totals.overtime_minutes}m</div>
               <div>Idle: {totals.idle_minutes}m</div>
               <div>Activity: {totals.activity_percent}%</div>
               <div>Screenshots: {totals.screenshots_count}</div>
             </div>
          </GlassCard>

          {anomalies.length > 0 && (
            <GlassCard title="⚠️ Anomalies Detected">
              <ul style={{ color: '#ff4444', margin: 0, paddingLeft: 20 }}>
                {anomalies.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </GlassCard>
          )}
        </div>
        
        {status === 'submitted' && (
          <GlassCard title="Review Actions">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <textarea 
                    placeholder="Reason (required for Reject/Changes Required)"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    style={{ 
                        width: '100%', 
                        minHeight: 80, 
                        background: 'rgba(255,255,255,0.1)', 
                        border: '1px solid rgba(255,255,255,0.2)', 
                        color: 'white', 
                        padding: 8,
                        borderRadius: 4
                    }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                    <GlassButton variant="primary" onClick={()=>review('approve')}>Approve</GlassButton>
                    <GlassButton onClick={()=>review('changes_required')}>Request Changes</GlassButton>
                    <GlassButton onClick={()=>review('reject')}>Reject</GlassButton>
                </div>
            </div>
          </GlassCard>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <GlassCard title="Daily Breakdown">
          <GlassTable columns={['Date', 'Worked', 'Breaks']} rows={itemRows} />
        </GlassCard>
      </div>
    </AppShell>
  )
}
