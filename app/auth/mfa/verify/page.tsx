'use client'
import { useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassInput from '@components/ui/GlassInput'

export default function VerifyMfaPage() {
  const [code, setCode] = useState('')
  const [trust, setTrust] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!code.trim()) { setError('Enter the verification code'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/security/mfa/verify', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ code, trust_device: trust }) })
      if (!res.ok) { setError('Invalid code'); return }
      window.location.href = '/'
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell title="Verify MFA">
      <GlassCard title="Multi-Factor Verification">
        <div className="grid grid-1" style={{ gap: 12 }}>
          <div>
            <div className="label">Verification Code</div>
            <GlassInput value={code} onChange={e=>setCode(e.target.value)} placeholder="123456" />
          </div>
          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" className="toggle" checked={trust} onChange={e=>setTrust(e.target.checked)} />
            <span className="label">Trust this device</span>
          </label>
          <div className="row" style={{ gap: 8 }}>
            <GlassButton variant="primary" onClick={submit}>{loading? 'Verifying…' : 'Verify'}</GlassButton>
            {error && <span className="subtitle">{error}</span>}
          </div>
        </div>
      </GlassCard>
    </AppShell>
  )
}
