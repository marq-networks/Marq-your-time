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

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string }
type Ticket = { id: string, orgId: string, createdByUserId: string, category: string, title: string, description?: string, status: string, priority: string, assignedToUserId?: string, createdAt: number, updatedAt: number }
type Comment = { id: string, ticketId: string, userId: string, body: string, createdAt: number }

export default function SupportPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [orgId, setOrgId] = useState('')
  const [userId, setUserId] = useState('')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [openCreate, setOpenCreate] = useState(false)
  const [form, setForm] = useState<any>({ category:'hr', title:'', description:'', priority:'normal' })
  const [openDetail, setOpenDetail] = useState(false)
  const [detail, setDetail] = useState<{ ticket: Ticket, comments: Comment[] } | null>(null)
  const [newComment, setNewComment] = useState('')

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store' }); const d = await res.json(); setOrgs(d.items||[]); if(!orgId && d.items?.length) setOrgId(d.items[0].id) }
  const loadUsers = async (oid: string) => { const res = await fetch(`/api/user/list?orgId=${oid}`, { cache:'no-store' }); const d = await res.json(); setUsers(d.items||[]); if(!userId && d.items?.length) setUserId(d.items[0].id) }
  const loadMy = async (uid: string) => { const res = await fetch(`/api/support/tickets/my?user_id=${uid}`, { cache:'no-store' }); const d = await res.json(); setTickets(d.items||[]) }
  const openTicket = async (id: string) => { const res = await fetch(`/api/support/tickets/detail?id=${id}`, { cache:'no-store' }); const d = await res.json(); setDetail(d); setOpenDetail(true) }
  const submitCreate = async () => {
    if (!orgId || !userId || !form.category || !form.title) return
    const res = await fetch('/api/support/tickets/create', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-user-id': userId }, body: JSON.stringify({ org_id: orgId, category: form.category, title: form.title, description: form.description, priority: form.priority }) })
    if (res.ok) { setOpenCreate(false); setForm({ category:'hr', title:'', description:'', priority:'normal' }); await loadMy(userId) }
  }
  const submitComment = async () => {
    if (!detail || !newComment.trim()) return
    const res = await fetch('/api/support/tickets/comment', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-user-id': userId }, body: JSON.stringify({ ticket_id: detail.ticket.id, body: newComment }) })
    if (res.ok) { setNewComment(''); await openTicket(detail.ticket.id) }
  }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if (orgId) loadUsers(orgId) }, [orgId])
  useEffect(()=>{ if (userId) loadMy(userId) }, [userId])

  const columns = ['Title','Category','Status','Priority','Created']
  const rows = tickets.map(t => [
    <button className="link" onClick={()=>openTicket(t.id)}>{t.title}</button>,
    <TagPill tone='muted'>{t.category}</TagPill>,
    <TagPill tone={t.status==='open'?'accent':t.status==='in_progress'?'muted':'danger'}>{t.status}</TagPill>,
    <TagPill tone={t.priority==='high'?'danger':t.priority==='normal'?'muted':'accent'}>{t.priority}</TagPill>,
    new Date(t.createdAt).toLocaleString()
  ])

  return (
    <AppShell title="Support">
      <GlassCard title="Select">
        <div className="grid grid-2">
          <div>
            <div className="label">Organization</div>
            <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">User</div>
            <GlassSelect value={userId} onChange={(e:any)=>setUserId(e.target.value)}>
              <option value="">Select user</option>
              {users.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
            </GlassSelect>
          </div>
        </div>
      </GlassCard>

      <GlassCard title="My Tickets" right={<GlassButton onClick={()=>setOpenCreate(true)}>Create ticket</GlassButton>}>
        <GlassTable columns={columns} rows={rows} />
      </GlassCard>

      <GlassModal open={openCreate} title="Create Ticket" onClose={()=>setOpenCreate(false)}>
        <div className="grid grid-2">
          <div>
            <div className="label">Category</div>
            <GlassSelect value={form.category} onChange={(e:any)=>setForm({...form, category:e.target.value})}>
              <option value="hr">HR</option>
              <option value="it">IT</option>
              <option value="payroll">Payroll</option>
              <option value="other">Other</option>
            </GlassSelect>
          </div>
          <div>
            <div className="label">Priority</div>
            <GlassSelect value={form.priority} onChange={(e:any)=>setForm({...form, priority:e.target.value})}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </GlassSelect>
          </div>
        </div>
        <div className="grid grid-1" style={{marginTop:12}}>
          <div>
            <div className="label">Title</div>
            <GlassInput value={form.title} onChange={(e:any)=>setForm({...form, title:e.target.value})} />
          </div>
          <div>
            <div className="label">Description</div>
            <textarea className="input" rows={4} value={form.description} onChange={e=>setForm({...form, description:e.target.value})} />
          </div>
        </div>
        <div className="row" style={{justifyContent:'flex-end',gap:8,marginTop:12}}>
          <GlassButton onClick={submitCreate}>Submit</GlassButton>
        </div>
      </GlassModal>

      <GlassModal open={openDetail} title={detail?.ticket.title || 'Ticket'} onClose={()=>setOpenDetail(false)}>
        {detail && (
          <div className="grid-1" style={{gap:12}}>
            <div className="row" style={{gap:8,alignItems:'center'}}>
              <TagPill tone='muted'>{detail.ticket.category}</TagPill>
              <TagPill tone={detail.ticket.status==='open'?'accent':detail.ticket.status==='in_progress'?'muted':'danger'}>{detail.ticket.status}</TagPill>
              <TagPill tone={detail.ticket.priority==='high'?'danger':detail.ticket.priority==='normal'?'muted':'accent'}>{detail.ticket.priority}</TagPill>
            </div>
            <div className="subtitle">{detail.ticket.description || ''}</div>
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

