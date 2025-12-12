'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import GlassModal from '@components/ui/GlassModal'
import Toast from '@components/Toast'

type Org = { id: string, orgName: string, subscriptionType: string, usedSeats: number, totalLicensedSeats: number, pricePerLogin: number }

export default function OrgList() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{m?:string,t?:'success'|'error'}>({})
  const role = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '').toLowerCase() : ''

  const load = async () => {
    const r = await fetch('/api/org/list', { cache: 'no-store' })
    const d = await r.json()
    setOrgs(d.items || [])
  }
  useEffect(() => { load() }, [])

  const submitInvite = async () => {
    if (loading) return
    if (!inviteEmail.trim()) { setToast({ m:'Enter email', t:'error' }); return }
    setLoading(true)
    const r = await fetch('/api/orgs/invite/create', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-role': role || 'super_admin' }, body: JSON.stringify({ invited_email: inviteEmail }) })
    const d = await r.json()
    if (r.ok) { setInviteUrl(d.invite_url || ''); setToast({ m:'Invite sent', t:'success' }) } else setToast({ m: d.error || 'Error', t:'error' })
    setLoading(false)
  }

  const columns = ['Logo','Name','Subscription','Seats Used/Total','Price/Login','Status','Actions']
  const rows = orgs.map((o: any) => [
    <div key={o.id} style={{width:28,height:28,borderRadius:8,background:'#111',border:'1px solid var(--border)'}}></div>,
    o.orgName,
    o.subscriptionType,
    `${o.usedSeats}/${o.totalLicensedSeats}`,
    `$${o.pricePerLogin}`,
    <span className="badge">active</span>,
    <a className="btn btn-primary" href={`/org/${o.id}`}>Open</a>
  ])

  return (
    <AppShell title="Organizations">
      <GlassCard title="Organization List" right={role==='super_admin' ? <GlassButton variant="primary" onClick={()=>{ setInviteEmail(''); setInviteUrl(''); setInviteOpen(true) }}>Invite Organization</GlassButton> : undefined}>
        <GlassTable columns={columns} rows={rows} />
      </GlassCard>
      <GlassModal open={inviteOpen} title="Invite Organization" onClose={()=>setInviteOpen(false)}>
        <div className="grid">
          <div>
            <div className="label">Email</div>
            <input className="input" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="recipient@example.com" />
          </div>
          <div className="row" style={{justifyContent:'flex-end',gap:8}}>
            <GlassButton variant="primary" onClick={submitInvite} style={{ opacity: loading ? 0.7 : 1, pointerEvents: loading ? 'none' : 'auto' }}>{loading? 'Sending…' : 'Send Invite'}</GlassButton>
          </div>
          {inviteUrl && (
            <div className="grid">
              <div className="label">Invite Link</div>
              <input className="input" readOnly value={inviteUrl} />
              <div className="subtitle">The recipient will receive this link by email.</div>
            </div>
          )}
        </div>
        <Toast message={toast.m} type={toast.t} />
      </GlassModal>
    </AppShell>
  )
}
