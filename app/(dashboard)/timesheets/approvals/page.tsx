'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'

type Org = { id: string, orgName: string }

export default function TimesheetApprovalsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('submitted')
  const router = useRouter()
  
  const role = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''
  const userId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_user_id='))?.split('=')[1] || '') : ''
  const currentOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''

  const loadOrgs = async () => {
    try {
      if (role === 'super_admin') {
        const r = await fetch('/api/org/list', { cache:'no-store', headers:{ 'x-user-id': userId, 'x-role': role } })
        const d = await r.json()
        setOrgs(d.items || [])
        if (d.items && d.items.length > 0 && !orgId) setOrgId(d.items[0].id)
      } else {
        // Load user's organizations
        const r = await fetch('/api/orgs/my', { cache:'no-store', headers:{ 'x-user-id': userId } })
        const d = await r.json()
        setOrgs(d.items || [])
        if (d.items && d.items.length > 0) {
          // Prefer current_org_id if in the list, otherwise first
          const match = d.items.find((o:any) => o.id === currentOrgId)
          setOrgId(match ? match.id : d.items[0].id)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const loadItems = async () => {
    if (!orgId) { setItems([]); return }
    try {
      const r = await fetch(`/api/timesheets/list?org_id=${orgId}&status=${statusFilter}`, { cache:'no-store', headers:{ 'x-role': role || 'admin', 'x-user-id': userId } })
      const d = await r.json()
      setItems(d.items || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ loadItems() }, [orgId, statusFilter])

  const rows = items.map((it: any) => [
    `${it.employees?.first_name} ${it.employees?.last_name}`,
    `${it.period_start} - ${it.period_end}`,
    it.status.toUpperCase(),
    `${Math.round(it.totals.worked_minutes / 60)}h ${it.totals.worked_minutes % 60}m`,
    <GlassButton onClick={()=>router.push(`/timesheets/approvals/${it.id}`)}>Review</GlassButton>
  ])

  return (
    <AppShell title="Timesheet Approvals">
      <GlassCard title="Filters">
        <div className="grid-2">
          <div>
            <div className="label">Organization</div>
            <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">Status</div>
            <GlassSelect value={statusFilter} onChange={(e:any)=>setStatusFilter(e.target.value)}>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="changes_required">Changes Required</option>
              <option value="draft">Draft (All)</option>
            </GlassSelect>
          </div>
        </div>
      </GlassCard>
      <GlassCard title="Timesheets">
        <GlassTable columns={[ 'Employee', 'Period', 'Status', 'Total Worked', 'Actions' ]} rows={rows} />
      </GlassCard>
    </AppShell>
  )
}
