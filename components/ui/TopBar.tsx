'use client'
import { useEffect, useState } from 'react'
import NotificationsBell from './NotificationsBell'
import GlassSelect from './GlassSelect'
import { normalizeRoleForApi } from '@lib/permissions'

type OrgItem = { id: string, orgName: string }

function getCookie(name: string) {
  const m = document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))
  return m ? decodeURIComponent(m.split('=').slice(1).join('=')) : ''
}

export default function TopBar({ title }: { title: string }) {
  const [orgs, setOrgs] = useState<OrgItem[]>([])
  const [current, setCurrent] = useState<string>('')
  const [userName, setUserName] = useState<string>('')
  const [orgName, setOrgName] = useState<string>('')
  const [orgLogo, setOrgLogo] = useState<string>('')
  const [orgSession, setOrgSession] = useState<boolean>(false)
  const [role, setRole] = useState<string>('')
  const [userTheme, setUserTheme] = useState<{ bg?: string, accent?: string, layout?: 'cozy'|'compact' } | null>(null)
  const [orgTheme, setOrgTheme] = useState<{ bg?: string, accent?: string, layout?: 'cozy'|'compact' } | null>(null)

  const loadOrgs = async () => {
    try {
      const res = await fetch('/api/orgs/my', { cache: 'no-store' })
      const j = await res.json()
      const items = (j.items || []) as any[]
      setOrgs(items.map(i => ({ id: i.id, orgName: i.orgName })))
      setOrgSession(getCookie('org_login') === '1')
      setCurrent(getCookie('current_org_id') || items[0]?.id || '')
    } catch {}
  }

  useEffect(() => { loadOrgs() }, [])
  useEffect(() => { (async()=>{ try { const res = await fetch('/api/security/mfa/status', { cache:'no-store' }); const d = await res.json(); const n = d.name || d.email || ''; setUserName(n) } catch {} })() }, [])
  useEffect(() => { try { const r = normalizeRoleForApi(getCookie('current_role') || ''); setRole(r) } catch {} }, [])
  useEffect(() => {
    (async()=>{
      try {
        if (!current || !orgSession) return
        const res = await fetch(`/api/org/${current}`, { cache:'no-store' })
        const d = await res.json()
        const o = d.org || {}
        setOrgName(o.orgName || '')
        setOrgLogo(o.orgLogo || '')
        setOrgTheme({ bg: o.themeBgMain || undefined, accent: o.themeAccent || undefined, layout: o.layoutType || undefined })
      } catch {}
    })()
  }, [current, orgSession])
  useEffect(() => {
    (async()=>{
      try {
        const userId = getCookie('current_user_id') || ''
        if (!userId) return
        const res = await fetch(`/api/user/${userId}`, { cache:'no-store' })
        const d = await res.json()
        const u = d.user || {}
        setUserTheme({ bg: u.themeBgMain || undefined, accent: u.themeAccent || undefined, layout: u.layoutType || undefined })
      } catch {}
    })()
  }, [])
  useEffect(() => {
    try {
      const root = document.documentElement
      const bg = (userTheme?.bg || orgTheme?.bg)
      const accent = (userTheme?.accent || orgTheme?.accent)
      const layout = (userTheme?.layout || orgTheme?.layout)
      if (bg) root.style.setProperty('--color-bg-main', bg)
      if (accent) {
        root.style.setProperty('--color-accent', accent)
        const accentTagBg = `${accent}30`
        root.style.setProperty('--tag-accent-bg', accentTagBg)
      }
      if (layout) {
        const compact = layout === 'compact'
        root.style.setProperty('--spacing-md', compact ? '16px' : '20px')
        root.style.setProperty('--spacing-lg', compact ? '20px' : '24px')
        root.style.setProperty('--spacing-xl', compact ? '28px' : '32px')
      }
    } catch {}
  }, [userTheme, orgTheme])

  const onSwitch = async (id: string) => {
    setCurrent(id)
    try {
      await fetch('/api/orgs/switch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ org_id: id }) })
      location.reload()
    } catch {}
  }

  return (
    <div className="topbar glass-panel" style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderRadius:'var(--radius-large)',overflow:'visible',position:'relative'}}>
      <div className="page-title" style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{width:32,height:32,borderRadius:10,background:'#111',border:'1px solid var(--border)',overflow:'hidden'}}>
          {orgSession && orgLogo && <img src={orgLogo} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />}
        </div>
        <div>{title}</div>
        {(['member','employee'].includes(role)) && <span className="tag-pill">{orgName || orgs.find(o=>o.id===current)?.orgName || orgs[0]?.orgName || ''}</span>}
      </div>
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
          <div className="user-name">{orgSession ? (orgName || orgs.find(o=>o.id===current)?.orgName || orgs[0]?.orgName || 'Organization') : (userName || 'User')}</div>
        </div>
      </div>
    </div>
  )
}
