"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'
import GlassInput from '@components/ui/GlassInput'
import { normalizeRoleForApi } from '@lib/permissions'
import { exportToCsv, exportToPdf, type ExportColumn } from '@/lib/export-utils'
import ExportMenu from '@/components/shared/ExportMenu'
import { Bell, Send, Filter, User, Building, ExternalLink, CheckCircle, RefreshCw, Trash2, Mail, Info, AlertCircle, Megaphone } from 'lucide-react'

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
  const [selfOrgName, setSelfOrgName] = useState('')
  const [selfMemberName, setSelfMemberName] = useState('')

  const [sendOrgId, setSendOrgId] = useState('')
  const [sendMemberId, setSendMemberId] = useState('')
  const [sendType, setSendType] = useState<'system'|'attendance'|'payroll'|'device'|'agent'|'billing'>('system')
  const [sendTitle, setSendTitle] = useState('')
  const [sendMessage, setSendMessage] = useState('')
  const [sendUrl, setSendUrl] = useState('')
  const [sending, setSending] = useState(false)
  const [sendStatus, setSendStatus] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      const exportItems = items.map(n => ({
        title: n.title,
        message: n.message,
        type: n.type,
        createdAt: new Date(n.createdAt).toLocaleString(),
        isRead: n.isRead ? 'Yes' : 'No'
      }))
      const exportColumns: ExportColumn[] = [
        { header: 'Title', accessor: 'title' },
        { header: 'Message', accessor: 'message' },
        { header: 'Type', accessor: 'type' },
        { header: 'Date', accessor: 'createdAt' },
        { header: 'Read', accessor: 'isRead' },
      ]
      const filename = `marq_notifications_${new Date().toISOString().split('T')[0]}`
      if (type === 'csv') await exportToCsv(exportItems, exportColumns, filename)
      else await exportToPdf(exportItems, exportColumns, 'Notifications', filename)
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

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
  useEffect(() => {
    try {
      const cookieUserId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_user_id='))?.split('=')[1] || '') : ''
      if (!memberId && cookieUserId) setMemberId(cookieUserId)
    } catch {}
  }, [])
  useEffect(()=>{ if (role && ['admin','owner','super_admin'].includes(role)) loadOrgs() }, [role])
  useEffect(()=>{ if (orgId && ['admin','owner','super_admin'].includes(role)) loadMembers(orgId) }, [orgId, role])
  useEffect(()=>{ setCursor(null); load(true) }, [orgId, memberId])
  useEffect(() => { if (sendOrgId && ['admin','owner','super_admin'].includes(role)) loadMembers(sendOrgId) }, [sendOrgId, role])
  useEffect(() => {
    if (!['member','employee'].includes(role)) return
    const run = async () => {
      try {
        const oid = orgId || (typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : '')
        const mid = memberId || (typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_user_id='))?.split('=')[1] || '') : '')
        if (!oid || !mid) return
        try {
          const resOrg = await fetch(`/api/org/${oid}`, { cache:'no-store' })
          const dOrg = await resOrg.json()
          const o = dOrg.org || {}
          setSelfOrgName(o.orgName || '')
        } catch {}
        try {
          const resUser = await fetch(`/api/user/${mid}`, { cache:'no-store' })
          const dUser = await resUser.json()
          const u = dUser.user || {}
          const full = (u.fullName || '').trim() || [u.firstName, u.lastName].filter(Boolean).join(' ')
          setSelfMemberName(full || '')
        } catch {}
      } catch {}
    }
    run()
  }, [role, orgId, memberId])

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
        <GlassCard 
          title={
            <div className="flex items-center gap-2">
              <Megaphone className="text-indigo-600" size={20} />
              <span>Send Notification</span>
            </div>
          }
          className="mb-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
                <Building size={12} /> Organization
              </div>
              {role === 'super_admin' ? (
                <GlassSelect value={sendOrgId} onChange={(e:any)=>{ setSendOrgId(e.target.value); if (e.target.value) loadMembers(e.target.value) }} className="w-full bg-white">
                  <option value="">Select org</option>
                  {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
                </GlassSelect>
              ) : (
                <div className="px-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-600 border border-slate-200">
                  {orgs.find(o=>o.id===sendOrgId)?.orgName || orgs.find(o=>o.id===orgId)?.orgName || 'Current Org'}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
                <User size={12} /> Recipient (Optional)
              </div>
              <GlassSelect value={sendMemberId} onChange={(e:any)=>setSendMemberId(e.target.value)} className="w-full bg-white">
                <option value="">All members (Broadcast)</option>
                {members.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
              </GlassSelect>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
                <Info size={12} /> Type
              </div>
              <GlassSelect value={sendType} onChange={(e:any)=>setSendType(e.target.value)} className="w-full bg-white">
                <option value="system">System</option>
                <option value="attendance">Attendance</option>
                <option value="payroll">Payroll</option>
                <option value="device">Device</option>
                <option value="agent">Agent</option>
                <option value="billing">Billing</option>
              </GlassSelect>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">Title</div>
              <GlassInput value={sendTitle} onChange={(e:any)=>setSendTitle(e.target.value)} placeholder="Notification Title" className="w-full bg-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">Link (Optional)</div>
              <GlassInput value={sendUrl} onChange={(e:any)=>setSendUrl(e.target.value)} placeholder="https://..." className="w-full bg-white" />
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">Message</div>
            <textarea 
              value={sendMessage} 
              onChange={(e:any)=>setSendMessage(e.target.value)} 
              className="input w-full bg-white min-h-[100px] p-3 text-sm" 
              placeholder="Write your message here..." 
            />
          </div>

          <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
            {sendStatus && (
              <span className={`text-sm font-medium ${sendStatus==='Sent'?'text-emerald-600':'text-rose-600'}`}>
                {sendStatus}
              </span>
            )}
            <GlassButton 
              variant="primary" 
              onClick={sendNotification} 
              disabled={sending} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-lg shadow-indigo-200 flex items-center gap-2 px-6"
            >
              {sending ? <RefreshCw className="animate-spin" size={16} /> : <Send size={16} />}
              {sending ? 'Sending...' : 'Send Notification'}
            </GlassButton>
          </div>
        </GlassCard>
      )}

      <GlassCard 
        title={
          <div className="flex items-center gap-2">
            <Bell className="text-indigo-600" size={20} />
            <span>Notification List</span>
          </div>
        }
        right={<ExportMenu onExport={handleExport} isExporting={isExporting} />}
      >
        <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
              <Building size={12} /> Organization
            </div>
            {['admin','owner','super_admin'].includes(role) ? (
              <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)} className="w-full bg-white">
                <option value="">All orgs</option>
                {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
              </GlassSelect>
            ) : (
              <div className="px-3 py-2 bg-white rounded-lg text-sm text-slate-600 border border-slate-200">
                {selfOrgName || 'Current Org'}
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1.5">
              <User size={12} /> Member
            </div>
            {['admin','owner','super_admin'].includes(role) ? (
              <GlassSelect value={memberId} onChange={(e:any)=>setMemberId(e.target.value)} className="w-full bg-white">
                <option value="">All members</option>
                {members.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
              </GlassSelect>
            ) : (
              <div className="px-3 py-2 bg-white rounded-lg text-sm text-slate-600 border border-slate-200">
                {selfMemberName || 'You'}
              </div>
            )}
          </div>

          <div className="flex items-end">
            <GlassButton 
              variant="secondary" 
              onClick={()=>load(false)} 
              className="w-full md:w-auto flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} /> Load more
            </GlassButton>
          </div>
        </div>

        {items.length > 0 ? (
          <GlassTable columns={columns} rows={rows} />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-slate-50/30 rounded-xl border border-dashed border-slate-200">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
              <Bell size={32} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-600 mb-1">No notifications</h3>
            <p className="text-sm text-slate-500">You're all caught up!</p>
          </div>
        )}
      </GlassCard>
    </AppShell>
  )
}
