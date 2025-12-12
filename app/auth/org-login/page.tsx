'use client'
import { useState } from 'react'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import Toast from '@components/Toast'
import '../login/styles.css'

export default function OrgLoginPage() {
  const [orgName, setOrgName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{m?:string,t?:'success'|'error'}>({})

  const submit = async () => {
    if (loading) return
    if (!orgName) { setToast({ m:'Enter organization name', t:'error' }); return }
    setLoading(true)
    const r = await fetch('/api/auth/org-login', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ org_name: orgName, org_password: password }) })
    const d = await r.json()
    if (!r.ok) { setToast({ m: d.error || 'Login failed', t:'error' }); setLoading(false); return }
    window.location.href = '/'
  }

  return (
    <div className="login-root">
      <div className="login-center">
        <div className="login-card" aria-label="Organization Login">
          <GlassCard>
            <div className="login-header">
              <div className="login-logo" aria-hidden="true" />
              <div className="login-brand">MARQ</div>
              <div className="login-tagline">Organization Sign In</div>
            </div>
            <div className="field">
              <label className="label">Organization Name</label>
              <input className="input" value={orgName} onChange={e=>setOrgName(e.target.value)} placeholder="Your org name" />
            </div>
            <div className="field">
              <label className="label">Org Password</label>
              <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="row" style={{marginTop:12}}>
              <GlassButton variant="primary" onClick={submit} style={{ opacity: loading ? 0.6 : 1, pointerEvents: loading ? 'none' : 'auto' }}>{loading? 'Verifying…' : 'Continue'}</GlassButton>
            </div>
          </GlassCard>
          <div className="login-footer">
            <a href="/auth/login" className="login-link">Back to User Sign In</a>
          </div>
        </div>
      </div>
      <Toast message={toast.m} type={toast.t} />
    </div>
  )
}
