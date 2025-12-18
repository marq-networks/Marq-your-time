"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'
import GlassInput from '@components/ui/GlassInput'
import { normalizeRoleForApi } from '@lib/permissions'

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
  const [role, setRole] = useState('')

  const [sendOrgId, setSendOrgId] = useState('')
  const [sendMemberId, setSendMemberId] = useState('')
  const [sendType, setSendType] = useState<'system'|'attendance'|'payroll'|'device'|'agent'|'billing'>('system')
  const [sendTitle, setSendTitle] = useState('')
  const [sendMessage, setSendMessage] = useState('')
  const [sendUrl, setSendUrl] = useState('')
  const [sending, setSending] = useState(false)
  const [sendStatus, setSendStatus] = useState<string | null>(null)

  const loadOrgs = async () => {
    const res = await fetch('/api/org/list', { cache:'no-store' })
    const d = await res.json()
    setOrgs(d.items || [])
    if (!orgId && d.items?.length) {
      setOrgId(d.items[0].id)
      if (!sendOrgId) setSendOrgId(d.items[0].id)
    }
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
  const sendNotification = async () => {
    setSendStatus(null)
    if (!sendOrgId || !sendTitle || !sendMessage) { setSendStatus('Please fill organization, title and message.'); return }
    setSending(true)
    try {
      const body: any = { orgId: sendOrgId, type: sendType, title: sendTitle, message: sendMessage }
      if (sendMemberId) body.memberId = sendMemberId
      if (sendUrl) body.meta = { url: sendUrl }
      const res = await fetch('/api/notifications/publish', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) })
      const d = await res.json()
      if (!res.ok) {
        setSendStatus(typeof d?.error === 'string' ? d.error : 'ERROR')
      } else {
        setSendStatus('Sent')
        setSendTitle(''); setSendMessage(''); setSendUrl(''); setSendMemberId('')
        setCursor(null); await load(true)
      }
    } catch {
      setSendStatus('ERROR')
    } finally {
      setSending(false)
    }
  }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ if (orgId) loadMembers(orgId) }, [orgId])
  useEffect(()=>{ setCursor(null); load(true) }, [orgId, memberId])
  useEffect(() => {
    try {
      const r = normalizeRoleForApi((typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''))
      setRole(r)
    } catch {}
  }, [])
  useEffect(() => {
    try {
      const cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
      if (!orgId && cookieOrgId) setOrgId(cookieOrgId)
      if (!sendOrgId && cookieOrgId) setSendOrgId(cookieOrgId)
    } catch {}
  }, [])
  useEffect(() => { if (sendOrgId) loadMembers(sendOrgId) }, [sendOrgId])

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
      {['admin','owner','super_admin'].includes(role) && (
        <GlassCard title="Send Notification">
          <div className="grid grid-3">
            <div>
              <div className="label">Organization</div>
              {role === 'super_admin' ? (
                <GlassSelect value={sendOrgId} onChange={(e:any)=>{ setSendOrgId(e.target.value); if (e.target.value) loadMembers(e.target.value) }}>
                  <option value="">Select org</option>
                  {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
                </GlassSelect>
              ) : (
                <span className="tag-pill">{orgs.find(o=>o.id===sendOrgId)?.orgName || orgs.find(o=>o.id===orgId)?.orgName || ''}</span>
              )}
            </div>
            <div>
              <div className="label">Recipient (optional)</div>
              <GlassSelect value={sendMemberId} onChange={(e:any)=>setSendMemberId(e.target.value)}>
                <option value="">All members (broadcast)</option>
                {members.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
              </GlassSelect>
            </div>
            <div>
              <div className="label">Type</div>
              <GlassSelect value={sendType} onChange={(e:any)=>setSendType(e.target.value)}>
                <option value="system">system</option>
                <option value="attendance">attendance</option>
                <option value="payroll">payroll</option>
                <option value="device">device</option>
                <option value="agent">agent</option>
                <option value="billing">billing</option>
              </GlassSelect>
            </div>
          </div>
          <div className="grid grid-2" style={{marginTop:16}}>
            <div>
              <div className="label">Title</div>
              <GlassInput value={sendTitle} onChange={(e:any)=>setSendTitle(e.target.value)} placeholder="Title" />
            </div>
            <div>
              <div className="label">Link (optional)</div>
              <GlassInput value={sendUrl} onChange={(e:any)=>setSendUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div style={{marginTop:16}}>
            <div className="label">Message</div>
            <textarea value={sendMessage} onChange={(e:any)=>setSendMessage(e.target.value)} className="input" rows={4} placeholder="Write your message" />
          </div>
          <div className="row" style={{marginTop:16}}>
            <GlassButton variant="primary" onClick={sendNotification} disabled={sending} style={{ background:'#39FF14', borderColor:'#39FF14' }}>
              {sending ? 'Sending…' : 'Send'}
            </GlassButton>
            {sendStatus && <span className="badge">{sendStatus}</span>}
          </div>
        </GlassCard>
      )}
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
