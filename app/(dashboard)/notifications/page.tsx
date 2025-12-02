"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'

type Org = { id: string, orgName: string }
type Member = { id: string, firstName: string, lastName: string }
type NotificationItem = { id: string, orgId: string, memberId?: string, type: string, title: string, message: string, meta?: any, isRead: boolean, createdAt: number }

export default function NotificationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [orgId, setOrgId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [items, setItems] = useState<NotificationItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)

  const loadOrgs = async () => {
    const res = await fetch('/api/org/list', { cache:'no-store' })
    const d = await res.json()
    setOrgs(d.items || [])
    if (!orgId && d.items?.length) setOrgId(d.items[0].id)
  }
  const loadMembers = async (oid: string) => {
    const res = await fetch(`/api/user/list?orgId=${oid}`, { cache:'no-store' })
    const d = await res.json()
    setMembers(d.items || [])
  }
  const load = async (reset = false) => {
    const qOrg = orgId ? `&org_id=${orgId}` : ''
    const qMem = memberId ? `&member_id=${memberId}` : ''
    const qCur = !reset && cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
    const res = await fetch(`/api/notifications/list?limit=50${qOrg}${qMem}${qCur}`, { cache:'no-store' })
    const d = await res.json()
    setItems(reset ? (d.items || []) : [...items, ...(d.items || [])])
    setCursor(d.nextCursor || null)
  }
  const markRead = async (id: string) => {
    await fetch('/api/notifications/mark-read', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ notification_id: id }) })
    setItems(items.map(i => i.id===id?{...i,isRead:true}:i))
  }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if (orgId) loadMembers(orgId) }, [orgId])
  useEffect(()=>{ setCursor(null); load(true) }, [orgId, memberId])

  const columns = ['','Title','Message','Type','Date','Actions']
  const rows = items.map(n => [
    <div style={{ width:10, height:10, borderRadius:999, background: n.isRead ? 'transparent' : '#39FF14', boxShadow: n.isRead ? 'none' : '0 0 0 2px rgba(57,255,20,0.35)' }} />,
    <div style={{ fontWeight:600 }}>{n.title}</div>,
    <div>{n.message}</div>,
    <span className="tag-pill accent">{n.type}</span>,
    new Date(n.createdAt).toLocaleString(),
    <div className="row">
      {!n.isRead && <GlassButton variant="secondary" onClick={()=>markRead(n.id)} style={{ background:'rgba(255,255,255,0.6)' }}>Mark read</GlassButton>}
      {n.meta?.url && <GlassButton variant="primary" href={n.meta.url} style={{ background:'#39FF14', borderColor:'#39FF14' }}>{n.meta?.cta||'Open'}</GlassButton>}
    </div>
  ])

  return (
    <AppShell title="Notifications">
      <GlassCard title="Filters">
        <div className="grid grid-3">
          <div>
            <div className="label">Organization</div>
            <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
              <option value="">All orgs</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">Member</div>
            <GlassSelect value={memberId} onChange={(e:any)=>setMemberId(e.target.value)}>
              <option value="">All members</option>
              {members.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
            </GlassSelect>
          </div>
          <div style={{display:'flex',alignItems:'flex-end'}}>
            <GlassButton variant="primary" onClick={()=>load(false)} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Load more</GlassButton>
          </div>
        </div>
      </GlassCard>
      <GlassCard title="Notification list">
        <GlassTable columns={columns} rows={rows} />
      </GlassCard>
    </AppShell>
  )
}
