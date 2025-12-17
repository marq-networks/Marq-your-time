'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import GlassModal from '@components/ui/GlassModal'
import GlassSelect from '@components/ui/GlassSelect'
import { normalizeRoleForApi } from '@lib/permissions'

type Org = { id: string, orgName: string }

export default function LeaveApprovalsPage() {
  const [forbidden, setForbidden] = useState(false)
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [open, setOpen] = useState<{ id?: string, action?: 'approved'|'rejected' } | null>(null)
  const [note, setNote] = useState('')
  const [role, setRole] = useState('')
  const [actorId, setActorId] = useState('')

  const loadOrgs = async () => {
    const endpoint = role === 'super_admin' ? '/api/org/list' : '/api/orgs/my'
    const res = await fetch(endpoint, { cache:'no-store' })
    const d = await res.json()
    const items: Org[] = Array.isArray(d.items) ? (d.items as Org[]) : []
    setOrgs(items)
    if (!orgId && items.length) {
      const cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
      const preferred = items.find(o => o.id === cookieOrgId)?.id || items[0].id
      setOrgId(preferred)
    }
  }
  const loadItems = async () => {
    if(!orgId) return
    const hdr: Record<string,string> = {}
    const r = role.toLowerCase()
    if (r === 'manager') {
      if (actorId) { hdr['x-role'] = 'manager'; hdr['x-user-id'] = actorId }
    } else if (['admin','owner','super_admin','org_admin','hr'].includes(r)) {
      hdr['x-role'] = 'org_admin'
    }
    const res = await fetch(`/api/leave/requests?org_id=${orgId}&status=pending`, { cache:'no-store', headers: hdr })
    if(res.status===403){ setForbidden(true); return }
    const d = await res.json()
    setItems(d.items||[])
  }
  const review = async () => {
    if(!open?.id || !open?.action) return
    const r = role.toLowerCase()
    const hdr: Record<string,string> = { 'Content-Type':'application/json' }
    if (r === 'manager') { hdr['x-role'] = 'manager'; if (actorId) hdr['x-user-id'] = actorId }
    else if (['admin','owner','super_admin','org_admin','hr'].includes(r)) { hdr['x-role'] = 'org_admin'; if (actorId) hdr['x-user-id'] = actorId }
    const res = await fetch('/api/leave/review', { method:'POST', headers: hdr, body: JSON.stringify({ request_id: open.id, status: open.action, note }) })
    if (res.status === 403) { setForbidden(true); return }
    setOpen(null); setNote(''); loadItems()
  }

  useEffect(()=>{ try { const r = normalizeRoleForApi((typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : '')); setRole(r); const uid = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_user_id='))?.split('=')[1] || '') : ''; setActorId(uid) } catch {} }, [])
  useEffect(()=>{ loadOrgs() }, [role])
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
