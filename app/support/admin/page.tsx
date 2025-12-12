'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassModal from '@components/ui/GlassModal'
import GlassSelect from '@components/ui/GlassSelect'
import GlassInput from '@components/ui/GlassInput'
import GlassTable from '@components/ui/GlassTable'
import TagPill from '@components/ui/TagPill'
import { normalizeRoleForApi } from '@lib/permissions'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string }
type Ticket = { id: string, orgId: string, createdByUserId: string, category: string, title: string, description?: string, status: string, priority: string, assignedToUserId?: string, createdAt: number, updatedAt: number }
type Comment = { id: string, ticketId: string, userId: string, body: string, createdAt: number }

export default function SupportAdminPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [orgId, setOrgId] = useState('')
  const [filters, setFilters] = useState<any>({ category:'', status:'', priority:'' })
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [openDetail, setOpenDetail] = useState(false)
  const [detail, setDetail] = useState<{ ticket: Ticket, comments: Comment[] } | null>(null)
  const [newComment, setNewComment] = useState('')
  const role = typeof document !== 'undefined' ? normalizeRoleForApi(document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store' }); const d = await res.json(); setOrgs(d.items||[]); if(!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadUsers = async (oid: string) => { const res = await fetch(`/api/user/list?orgId=${oid}`, { cache:'no-store' }); const d = await res.json(); setUsers(d.items||[]) }
  const loadTickets = async () => {
    if (!orgId) return
    const p = new URLSearchParams({ org_id: orgId })
    if (filters.status) p.set('status', filters.status)
    if (filters.category) p.set('category', filters.category)
    const res = await fetch(`/api/support/tickets/list?${p.toString()}`, { cache:'no-store', headers: { 'x-role': role || 'admin' } })
    const d = await res.json(); setTickets(d.items||[])
  }
  const openTicket = async (id: string) => { const res = await fetch(`/api/support/tickets/detail?id=${id}`, { cache:'no-store', headers: { 'x-role': role || 'admin' } }); const d = await res.json(); setDetail(d); setOpenDetail(true) }
  const updateTicket = async (patch: any) => {
    if (!detail) return
    const res = await fetch('/api/support/tickets/update', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-role': role || 'admin' }, body: JSON.stringify({ id: detail.ticket.id, ...patch }) })
    if (res.ok) { await openTicket(detail.ticket.id); await loadTickets() }
  }
  const submitComment = async () => {
    if (!detail || !newComment.trim()) return
    const res = await fetch('/api/support/tickets/comment', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-role': role || 'admin' }, body: JSON.stringify({ ticket_id: detail.ticket.id, user_id: detail.ticket.assignedToUserId || users[0]?.id || '', body: newComment }) })
    if (res.ok) { setNewComment(''); await openTicket(detail.ticket.id) }
  }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if (orgId) { loadUsers(orgId); loadTickets() } }, [orgId])
  useEffect(()=>{ loadTickets() }, [filters])

  const columns = ['Title','Category','Status','Priority','Assignee','Created','Actions']
  const rows = tickets.map(t => [
    t.title,
    <TagPill tone='muted'>{t.category}</TagPill>,
    <TagPill tone={t.status==='open'?'accent':t.status==='in_progress'?'muted':'danger'}>{t.status}</TagPill>,
    <TagPill tone={t.priority==='high'?'danger':t.priority==='normal'?'muted':'accent'}>{t.priority}</TagPill>,
    t.assignedToUserId ? (users.find(u=>u.id===t.assignedToUserId)?.firstName || 'Assigned') : 'Unassigned',
    new Date(t.createdAt).toLocaleString(),
    <GlassButton variant="secondary" onClick={()=>openTicket(t.id)}>View</GlassButton>
  ])

  return (
    <AppShell title="Support Admin">
      <GlassCard title="Filters">
        <div className="grid grid-4">
          <div>
            <div className="label">Organization</div>
            <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">Category</div>
            <GlassSelect value={filters.category} onChange={(e:any)=>setFilters({...filters, category:e.target.value})}>
              <option value="">All</option>
              <option value="hr">HR</option>
              <option value="it">IT</option>
              <option value="payroll">Payroll</option>
              <option value="other">Other</option>
            </GlassSelect>
          </div>
          <div>
            <div className="label">Status</div>
            <GlassSelect value={filters.status} onChange={(e:any)=>setFilters({...filters, status:e.target.value})}>
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </GlassSelect>
          </div>
          <div>
            <div className="label">Priority</div>
            <GlassSelect value={filters.priority} onChange={(e:any)=>setFilters({...filters, priority:e.target.value})}>
              <option value="">All</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </GlassSelect>
          </div>
        </div>
      </GlassCard>

      <GlassCard title="Tickets">
        <GlassTable columns={columns} rows={rows} />
      </GlassCard>

      <GlassModal open={openDetail} title={detail?.ticket.title || 'Ticket'} onClose={()=>setOpenDetail(false)}>
        {detail && (
          <div className="grid-1" style={{gap:12}}>
            <div className="row" style={{gap:8,alignItems:'center'}}>
              <TagPill tone='muted'>{detail.ticket.category}</TagPill>
              <TagPill tone={detail.ticket.status==='open'?'accent':detail.ticket.status==='in_progress'?'muted':'danger'}>{detail.ticket.status}</TagPill>
              <TagPill tone={detail.ticket.priority==='high'?'danger':detail.ticket.priority==='normal'?'muted':'accent'}>{detail.ticket.priority}</TagPill>
            </div>
            <div className="subtitle">{detail.ticket.description || ''}</div>
            <div className="grid grid-3">
              <div>
                <div className="label">Assign to</div>
                <GlassSelect value={detail.ticket.assignedToUserId || ''} onChange={(e:any)=>updateTicket({ assigned_to_user_id: e.target.value || null })}>
                  <option value="">Unassigned</option>
                  {users.map(u=> <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                </GlassSelect>
              </div>
              <div>
                <div className="label">Status</div>
                <GlassSelect value={detail.ticket.status} onChange={(e:any)=>updateTicket({ status: e.target.value })}>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </GlassSelect>
              </div>
              <div>
                <div className="label">Priority</div>
                <GlassSelect value={detail.ticket.priority} onChange={(e:any)=>updateTicket({ priority: e.target.value })}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </GlassSelect>
              </div>
            </div>
            <div className="label">Comments</div>
            <div className="grid-1" style={{maxHeight:200,overflow:'auto'}}>
              {(detail.comments||[]).map(c=> (
                <div key={c.id} className="glass-panel" style={{padding:8,borderRadius:12}}>
                  <div className="subtitle">{new Date(c.createdAt).toLocaleString()}</div>
                  <div>{c.body}</div>
                </div>
              ))}
            </div>
            <div className="row" style={{gap:8,marginTop:8}}>
              <input className="input" placeholder="Add a comment" value={newComment} onChange={e=>setNewComment(e.target.value)} />
              <GlassButton onClick={submitComment}>Send</GlassButton>
            </div>
          </div>
        )}
      </GlassModal>
    </AppShell>
  )
}
