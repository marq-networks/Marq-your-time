'use client'
import { useEffect, useState } from 'react'
import NotificationsBell from './NotificationsBell'
import GlassSelect from './GlassSelect'

type OrgItem = { id: string, orgName: string }

function getCookie(name: string) {
  const m = document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))
  return m ? decodeURIComponent(m.split('=').slice(1).join('=')) : ''
}

export default function TopBar({ title }: { title: string }) {
  const [orgs, setOrgs] = useState<OrgItem[]>([])
  const [current, setCurrent] = useState<string>('')
  const [userName, setUserName] = useState<string>('')

  const loadOrgs = async () => {
    try {
      const res = await fetch('/api/orgs/my', { cache: 'no-store' })
      const j = await res.json()
      const items = (j.items || []) as any[]
      setOrgs(items.map(i => ({ id: i.id, orgName: i.orgName })))
      setCurrent(getCookie('current_org_id') || items[0]?.id || '')
    } catch {}
  }

  useEffect(() => { loadOrgs() }, [])
  useEffect(() => { (async()=>{ try { const res = await fetch('/api/security/mfa/status', { cache:'no-store' }); const d = await res.json(); const n = d.name || d.email || ''; setUserName(n) } catch {} })() }, [])

  const onSwitch = async (id: string) => {
    setCurrent(id)
    try {
      await fetch('/api/orgs/switch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ org_id: id }) })
      location.reload()
    } catch {}
  }

  return (
    <div className="topbar glass-panel" style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderRadius:'var(--radius-large)'}}>
      <div className="page-title">{title}</div>
      <div className="row" style={{gap:12, alignItems:'center'}}>
        {orgs.length > 1 && (
          <div className="row" style={{alignItems:'center',gap:8}}>
            <span className="tag-pill accent">Org</span>
            <GlassSelect value={current} onChange={(e:any)=> onSwitch(e.target.value)} style={{ minWidth: 180 }}>
              {orgs.map(o => (<option key={o.id} value={o.id}>{o.orgName}</option>))}
            </GlassSelect>
          </div>
        )}
        <NotificationsBell />
        <div className="user-pill">
          <div className="avatar" />
          <div className="user-name">{orgs.find(o=>o.id===current)?.orgName || orgs[0]?.orgName || 'Organization'}</div>
        </div>
      </div>
    </div>
  )
}
