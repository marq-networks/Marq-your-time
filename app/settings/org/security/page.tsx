'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassInput from '@components/ui/GlassInput'
import GlassButton from '@components/ui/GlassButton'

export default function OrgSecuritySettings() {
  const [orgId, setOrgId] = useState('demo-org')
  const [requireMfa, setRequireMfa] = useState(false)
  const [timeoutMin, setTimeoutMin] = useState<number>(60)
  const [ipRanges, setIpRanges] = useState<string>('')

  const load = async () => {
    const res = await fetch(`/api/org-security/policy?org_id=${orgId}`, { cache:'no-store' })
    const d = await res.json()
    const p = d.policy
    setRequireMfa(!!p.requireMfa)
    setTimeoutMin(Number(p.sessionTimeoutMinutes || 60))
    setIpRanges((p.allowedIpRanges || []).join(','))
  }
  useEffect(()=>{ load() }, [])

  const save = async () => {
    await fetch('/api/org-security/policy/update', { method:'POST', headers:{ 'Content-Type':'application/json','x-role':'admin','x-org-id': orgId }, body: JSON.stringify({ require_mfa: requireMfa, session_timeout_minutes: timeoutMin, allowed_ip_ranges: ipRanges.split(',').map(s=>s.trim()).filter(Boolean) }) })
    await load()
  }

  return (
    <AppShell title="Org Settings: Security">
      <GlassCard title="Security Policy">
        <div className="grid" style={{ gap:12 }}>
          <label className="row" style={{ gap:8, alignItems:'center' }}>
            <input type="checkbox" className="toggle" checked={requireMfa} onChange={(e)=>setRequireMfa(e.target.checked)} />
            <span className="label">Require MFA for all users</span>
          </label>
          <div>
            <div className="label">Session timeout minutes</div>
            <GlassInput value={String(timeoutMin)} onChange={(e:any)=>setTimeoutMin(Number(e.target.value || 60))} />
          </div>
          <div>
            <div className="label">Allowed IP ranges (comma-separated)</div>
            <GlassInput value={ipRanges} onChange={(e:any)=>setIpRanges(e.target.value)} />
          </div>
          <div className="grid" style={{ gap:8 }}>
            <div className="label">SSO Provider (coming soon)</div>
            <div className="row" style={{ gap:8, opacity:0.7 }}>
              <GlassInput value="saml | oidc" readOnly />
              <GlassInput value="https://metadata-url" readOnly />
              <GlassInput value="client-id" readOnly />
            </div>
          </div>
          <div className="row" style={{ justifyContent:'flex-end' }}>
            <GlassButton variant="primary" onClick={save} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Save Policy</GlassButton>
          </div>
        </div>
      </GlassCard>
    </AppShell>
  )
}
