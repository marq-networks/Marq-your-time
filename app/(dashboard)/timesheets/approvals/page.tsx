'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import GlassModal from '@components/ui/GlassModal'

type Org = { id: string, orgName: string }

export default function TimesheetApprovalsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const role = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''

  const loadOrgs = async () => {
    const r = await fetch('/api/org/list', { cache:'no-store', headers:{ 'x-user-id': 'admin' } })
    const d = await r.json()
    setOrgs(d.items || [])
  }

  const loadItems = async () => {
    if (!orgId) { setItems([]); return }
    const r = await fetch(`/api/timesheets/change/list?org_id=${orgId}&status=pending`, { cache:'no-store', headers:{ 'x-role': role || 'admin' } })
    const d = await r.json()
    setItems(d.items || [])
  }

  const rows = items.map((it: any) => [ it.id, it.memberId, it.reason, <GlassButton onClick={()=>{ setSelected(it); setOpen(true) }}>Open</GlassButton> ])

  const approve = async () => {
    if (!selected) return
    await fetch('/api/timesheets/change/review', { method:'POST', headers:{ 'Content-Type':'application/json','x-role': role || 'admin','x-user-id':'admin' }, body: JSON.stringify({ change_request_id: selected.id, decision: 'approve', review_note: '' }) })
    setOpen(false)
    await loadItems()
  }

  const reject = async () => {
    if (!selected) return
    await fetch('/api/timesheets/change/review', { method:'POST', headers:{ 'Content-Type':'application/json','x-role': role || 'admin','x-user-id':'admin' }, body: JSON.stringify({ change_request_id: selected.id, decision: 'reject', review_note: '' }) })
    setOpen(false)
    await loadItems()
  }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ loadItems() }, [orgId])

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
        </div>
      </GlassCard>
      <GlassCard title="Pending Requests">
        <GlassTable columns={[ 'ID','Member','Reason','Actions' ]} rows={rows} />
      </GlassCard>
      <GlassModal open={open} title="Request Details" onClose={()=>setOpen(false)}>
        {selected && (
          <div>
            <div className="row" style={{ gap:8 }}>
              <div className="label">Member</div>
              <div>{selected.memberId}</div>
            </div>
            <div className="row" style={{ gap:8 }}>
              <div className="label">Reason</div>
              <div>{selected.reason}</div>
            </div>
            <div className="row" style={{ gap:8, marginTop:12 }}>
              <GlassButton variant="primary" onClick={approve}>Approve</GlassButton>
              <GlassButton onClick={reject}>Reject</GlassButton>
            </div>
          </div>
        )}
      </GlassModal>
    </AppShell>
  )
}
