'use client'
import { useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassInput from '@components/ui/GlassInput'

export default function ProfilePrivacyPage() {
  const [orgId, setOrgId] = useState('')
  const [userId, setUserId] = useState('')
  const [message, setMessage] = useState('')

  const init = () => {
    const oid = (localStorage.getItem('org_id') || localStorage.getItem('orgId') || '')
    const uid = (localStorage.getItem('user_id') || localStorage.getItem('userId') || '')
    if (oid) setOrgId(oid)
    if (uid) setUserId(uid)
  }

  const createRequest = async (type: 'export'|'delete') => {
    const res = await fetch('/api/privacy/request/create', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ org_id: orgId, user_id: userId, subject_type: 'user', subject_id: userId, request_type: type }) })
    const data = await res.json()
    if (res.ok) setMessage('Request created')
    else setMessage(data.error || 'Error')
  }

  return (
    <AppShell title="Privacy">
      <div style={{display:'grid',gap:16}}>
        <GlassCard title="My Privacy">
          <div style={{display:'grid',gap:8,maxWidth:480}}>
            <GlassInput placeholder="Org ID" value={orgId} onFocus={init} onChange={e=>setOrgId(e.target.value)} />
            <GlassInput placeholder="User ID" value={userId} onFocus={init} onChange={e=>setUserId(e.target.value)} />
            <div style={{display:'flex',gap:8}}>
              <GlassButton onClick={()=>createRequest('export')}>Request my data export</GlassButton>
              <GlassButton variant="secondary" onClick={()=>createRequest('delete')}>Request account deletion</GlassButton>
            </div>
            {message ? <div className="card-desc">{message}</div> : null}
          </div>
        </GlassCard>
      </div>
    </AppShell>
  )
}
