'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import GlassModal from '@components/ui/GlassModal'
import GlassSelect from '@components/ui/GlassSelect'

type Org = { id: string, orgName: string }

export default function LeaveApprovalsPage() {
  const [forbidden, setForbidden] = useState(false)
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [open, setOpen] = useState<{ id?: string, action?: 'approved'|'rejected' } | null>(null)
  const [note, setNote] = useState('')

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store' }); const d = await res.json(); setOrgs(d.items||[]); if(!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadItems = async () => { if(!orgId) return; const hdr = { 'x-role': 'manager' }; const res = await fetch(`/api/leave/requests?org_id=${orgId}&status=pending`, { cache:'no-store', headers: hdr }); if(res.status===403){ setForbidden(true); return } const d = await res.json(); setItems(d.items||[]) }
  const review = async () => { if(!open?.id || !open?.action) return; const hdr = { 'Content-Type':'application/json', 'x-role':'manager', 'x-user-id':'manager-user' }; await fetch('/api/leave/review', { method:'POST', headers: hdr, body: JSON.stringify({ request_id: open.id, status: open.action, note }) }); setOpen(null); setNote(''); loadItems() }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ loadItems() }, [orgId])

  if (forbidden) {
    return (
      <AppShell title="Leave Approvals">
        <div style={{display:'grid',placeItems:'center',height:'60vh'}}>
          <div className="glass-panel" style={{padding:24,borderRadius:'var(--radius-large)'}}>
            <div className="title">Access Denied</div>
            <div className="subtitle">You must be a Manager to view approvals.</div>
          </div>
        </div>
      </AppShell>
    )
  }

  const columns = ['Member','Type','Dates','Days','Reason','Actions']
  const rows = items.map(it => [ it.member_id, it.type_code, `${it.start_date} - ${it.end_date}`, String(it.days_count||0), it.reason||'', <div key={it.id} className="row" style={{gap:8}}><GlassButton onClick={()=>setOpen({ id: it.id, action:'approved' })}>Approve</GlassButton><GlassButton variant="secondary" onClick={()=>setOpen({ id: it.id, action:'rejected' })}>Reject</GlassButton></div> ])

  return (
    <AppShell title="Leave Approvals">
      <GlassCard title="Organization">
        <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
          <option value="">Select org</option>
          {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
        </GlassSelect>
      </GlassCard>
      <GlassCard title="Pending Requests">
        <GlassTable columns={columns} rows={rows} />
      </GlassCard>
      <GlassModal open={!!open} title="Review" onClose={()=>{ setOpen(null); setNote('') }}>
        <div className="grid-1">
          <div className="label">Note</div>
          <input className="input" value={note} onChange={e=>setNote(e.target.value)} />
          <div className="row" style={{justifyContent:'flex-end',gap:8,marginTop:12}}>
            <GlassButton onClick={review}>Submit</GlassButton>
          </div>
        </div>
      </GlassModal>
    </AppShell>
  )
}

