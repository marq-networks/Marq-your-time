'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import usePermission from '@lib/hooks/usePermission'
import Toast from '@components/Toast'

export default function SettingsPage() {
  const [form, setForm] = useState({ defaultSeatPrice: 5, defaultSeatLimit: 50, landingPageInviteEnabled: true })
  const [toast, setToast] = useState<{m?:string,t?:'success'|'error'}>({})

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

  const canSettings = usePermission('manage_settings').allowed
  return (
    <AppShell title="Settings">
      <GlassCard title="SaaS Settings">
        <div className="grid grid-2">
          <div>
            <div className="label">Default seat price</div>
            <input className="input" type="number" value={form.defaultSeatPrice} onChange={e=>setForm({...form, defaultSeatPrice: Number(e.target.value)})} />
          </div>
          <div>
            <div className="label">Default seat limit</div>
            <input className="input" type="number" value={form.defaultSeatLimit} onChange={e=>setForm({...form, defaultSeatLimit: Number(e.target.value)})} />
          </div>
          <div className="row" style={{gap:8}}>
            <input type="checkbox" checked={form.landingPageInviteEnabled} onChange={e=>setForm({...form, landingPageInviteEnabled: e.target.checked})} />
            <div className="label">Landing page invite enabled</div>
          </div>
        </div>
        <div className="row" style={{marginTop:12}}>
          {canSettings && <GlassButton variant="primary" onClick={save}>Save</GlassButton>}
        </div>
      </GlassCard>
      <Toast message={toast.m} type={toast.t} />
    </AppShell>
  )
}
