'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassInput from '@components/ui/GlassInput'
import GlassSelect from '@components/ui/GlassSelect'
import usePermission from '@lib/hooks/usePermission'
import Toast from '@components/Toast'
import { Settings, Palette, Layout, Save, CreditCard, Users, CheckSquare } from 'lucide-react'

export default function SettingsPage() {
  const [form, setForm] = useState({ defaultSeatPrice: 5, defaultSeatLimit: 50, landingPageInviteEnabled: true })
  const [toast, setToast] = useState<{m?:string,t?:'success'|'error'}>({})
  const [orgTheme, setOrgTheme] = useState<{ bg: string, accent: string, layout: 'cozy'|'compact' }>({ bg: '', accent: '', layout: 'cozy' })
  const [userTheme, setUserTheme] = useState<{ bg: string, accent: string, layout: 'cozy'|'compact' }>({ bg: '', accent: '', layout: 'cozy' })
  const [orgId, setOrgId] = useState<string>('')
  const [userId, setUserId] = useState<string>('')

  const getCookie = (name: string) => {
    if (typeof document === 'undefined') return ''
    const m = document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))
    return m ? decodeURIComponent(m.split('=').slice(1).join('=')) : ''
  }
  const load = async () => {
    const res = await fetch('/api/settings')
    const data = await res.json()
    if (res.ok) setForm(data.settings)
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    const res = await fetch('/api/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
    const data = await res.json()
    if (res.ok) setToast({ m:'Settings saved', t:'success' })
    else setToast({ m: data.error || 'Error', t:'error' })
  }

  useEffect(() => {
    try {
      const oid = getCookie('current_org_id') || ''
      const uid = getCookie('current_user_id') || ''
      setOrgId(oid)
      setUserId(uid)
      ;(async()=>{
        try {
          if (oid) {
            const res = await fetch(`/api/org/${oid}`, { cache: 'no-store' })
            const d = await res.json()
            const o = d.org || {}
            setOrgTheme({ bg: o.themeBgMain || '', accent: o.themeAccent || '', layout: (o.layoutType || 'cozy') })
          }
        } catch {}
      })()
      ;(async()=>{
        try {
          if (uid) {
            const res = await fetch(`/api/user/${uid}`, { cache: 'no-store' })
            const d = await res.json()
            const u = d.user || {}
            setUserTheme({ bg: u.themeBgMain || '', accent: u.themeAccent || '', layout: (u.layoutType || 'cozy') })
          }
        } catch {}
      })()
    } catch {}
  }, [])

  const saveOrgTheme = async () => {
    if (!orgId) { setToast({ m: 'Select organization', t: 'error' }); return }
    const payload = { themeBgMain: orgTheme.bg || null, themeAccent: orgTheme.accent || null, layoutType: orgTheme.layout || null }
    const res = await fetch(`/api/org/${orgId}/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (res.ok) {
      try {
        const root = document.documentElement
        if (orgTheme.bg) root.style.setProperty('--color-bg-main', orgTheme.bg)
        if (orgTheme.accent) root.style.setProperty('--color-accent', orgTheme.accent)
        if (orgTheme.layout) {
          const compact = orgTheme.layout === 'compact'
          root.style.setProperty('--spacing-md', compact ? '16px' : '20px')
          root.style.setProperty('--spacing-lg', compact ? '20px' : '24px')
          root.style.setProperty('--spacing-xl', compact ? '28px' : '32px')
        }
      } catch {}
      setToast({ m: 'Organization theme saved', t: 'success' })
    }
    else setToast({ m: data.error || 'Error', t: 'error' })
  }
  const saveUserTheme = async () => {
    if (!userId) { setToast({ m: 'Sign in to save', t: 'error' }); return }
    const payload = { themeBgMain: userTheme.bg || null, themeAccent: userTheme.accent || null, layoutType: userTheme.layout || null }
    const res = await fetch(`/api/user/${userId}/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (res.ok) {
      try {
        const root = document.documentElement
        if (userTheme.bg) root.style.setProperty('--color-bg-main', userTheme.bg)
        if (userTheme.accent) root.style.setProperty('--color-accent', userTheme.accent)
        if (userTheme.layout) {
          const compact = userTheme.layout === 'compact'
          root.style.setProperty('--spacing-md', compact ? '16px' : '20px')
          root.style.setProperty('--spacing-lg', compact ? '20px' : '24px')
          root.style.setProperty('--spacing-xl', compact ? '28px' : '32px')
        }
      } catch {}
      setToast({ m: 'Your theme saved', t: 'success' })
    }
    else setToast({ m: data.error || 'Error', t: 'error' })
  }

  const canSettings = usePermission('manage_settings').allowed
  const canOrg = usePermission('manage_org').allowed
  return (
    <AppShell title="Settings">
      <div className="grid grid-2 gap-6">
        <GlassCard title={<div className="flex items-center gap-2"><CreditCard size={18} /> SaaS Settings</div>}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">Default seat price</label>
              <GlassInput 
                type="number" 
                value={form.defaultSeatPrice} 
                onChange={e=>setForm({...form, defaultSeatPrice: Number(e.target.value)})} 
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">Default seat limit</label>
              <GlassInput 
                type="number" 
                value={form.defaultSeatLimit} 
                onChange={e=>setForm({...form, defaultSeatLimit: Number(e.target.value)})} 
              />
            </div>
            <div className="flex items-center gap-3 p-2 border border-border rounded-md">
              <input 
                type="checkbox" 
                className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                checked={form.landingPageInviteEnabled} 
                onChange={e=>setForm({...form, landingPageInviteEnabled: e.target.checked})} 
              />
              <div className="text-sm font-medium">Landing page invite enabled</div>
            </div>
            <div className="mt-2">
              {canSettings && <GlassButton variant="primary" onClick={save}><Save size={16}/> Save Settings</GlassButton>}
            </div>
          </div>
        </GlassCard>

        <div className="flex flex-col gap-6">
          <GlassCard title={<div className="flex items-center gap-2"><Palette size={18} /> Organization Theme</div>}>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">Background Color</label>
                <GlassInput 
                  placeholder="CSS color or gradient" 
                  value={orgTheme.bg} 
                  onChange={e=>setOrgTheme({...orgTheme, bg: e.target.value})} 
                />
                <div className="text-xs text-muted-foreground mt-1">Example: linear-gradient(to bottom right, #d9c7b2, #e8ddce)</div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">Accent Color</label>
                <GlassInput 
                  placeholder="#39FF14" 
                  value={orgTheme.accent} 
                  onChange={e=>setOrgTheme({...orgTheme, accent: e.target.value})} 
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground uppercase">Layout Density</label>
                <GlassSelect value={orgTheme.layout} onChange={(e: any)=>setOrgTheme({...orgTheme, layout: e.target.value})}>
                  <option value="cozy">Cozy (Standard)</option>
                  <option value="compact">Compact (High Density)</option>
                </GlassSelect>
              </div>
              <div className="mt-2">
                {canOrg && orgId && <GlassButton variant="primary" onClick={saveOrgTheme}><Save size={16}/> Save Org Theme</GlassButton>}
                {!canOrg && <span className="text-sm text-muted-foreground">You need org permissions to edit</span>}
              </div>
            </div>
          </GlassCard>

          <GlassCard title={<div className="flex items-center gap-2"><Users size={18} /> My Theme</div>}>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">Background Color</label>
                <GlassInput 
                  placeholder="CSS color or gradient" 
                  value={userTheme.bg} 
                  onChange={e=>setUserTheme({...userTheme, bg: e.target.value})} 
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase mb-1 block">Accent Color</label>
                <GlassInput 
                  placeholder="#39FF14" 
                  value={userTheme.accent} 
                  onChange={e=>setUserTheme({...userTheme, accent: e.target.value})} 
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground uppercase">Layout Density</label>
                <GlassSelect value={userTheme.layout} onChange={(e: any)=>setUserTheme({...userTheme, layout: e.target.value})}>
                  <option value="cozy">Cozy (Standard)</option>
                  <option value="compact">Compact (High Density)</option>
                </GlassSelect>
              </div>
              <div className="mt-2">
                <GlassButton variant="primary" onClick={saveUserTheme}><Save size={16}/> Save My Theme</GlassButton>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
      <Toast message={toast.m} type={toast.t} />
    </AppShell>
  )
}
