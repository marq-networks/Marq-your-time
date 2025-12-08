'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'

type MFA = { id: string, userId: string, mfaType: 'email_otp'|'totp', secret?: string, isEnabled: boolean }
type Device = { id: string, deviceLabel?: string, lastIp?: string, lastUsedAt?: number }

export default function SecuritySettings() {
  const [userId, setUserId] = useState('demo-user')
  const [orgId, setOrgId] = useState('demo-org')
  const [mfa, setMfa] = useState<MFA|null>(null)
  const [requireMfa, setRequireMfa] = useState(false)
  const [email, setEmail] = useState<string>('')
  const [devices, setDevices] = useState<Device[]>([])
  const [totpSecret, setTotpSecret] = useState<string>('')
  const [otpauthUri, setOtpauthUri] = useState<string>('')

  const load = async () => {
    const sres = await fetch(`/api/security/mfa/status?user_id=${userId}&org_id=${orgId}`, { cache:'no-store' })
    const sd = await sres.json()
    setMfa(sd.mfa || null)
    setRequireMfa(!!sd.require_mfa)
    setEmail(sd.email || '')
    const dres = await fetch(`/api/security/trusted-devices?user_id=${userId}`, { cache:'no-store' })
    const dd = await dres.json()
    setDevices(dd.items || [])
  }

  useEffect(()=>{ load() }, [])

  const setupTotp = async () => {
    const res = await fetch('/api/security/mfa/setup', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ user_id: userId, org_id: orgId, mfa_type: 'totp' }) })
    const d = await res.json()
    setMfa(d.settings || null)
    setTotpSecret(d.totpSecret || '')
    setOtpauthUri(d.otpauthUri || '')
  }
  const setupEmailOtp = async () => {
    const res = await fetch('/api/security/mfa/setup', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ user_id: userId, org_id: orgId, mfa_type: 'email_otp' }) })
    const d = await res.json()
    setMfa(d.settings || null)
  }
  const enable = async () => {
    const res = await fetch('/api/security/mfa/enable', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ user_id: userId }) })
    const d = await res.json()
    setMfa(d.mfa || null)
  }
  const disable = async () => {
    const res = await fetch('/api/security/mfa/disable', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ user_id: userId }) })
    const d = await res.json()
    setMfa(d.mfa || null)
  }
  const revoke = async (id: string) => {
    await fetch('/api/security/trusted-devices/revoke', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ device_id: id }) })
    await load()
  }

  const columns = ['Label','Last IP','Last Used','Actions']
  const rows = devices.map(d => [ d.deviceLabel || 'Unknown', d.lastIp || '-', d.lastUsedAt ? new Date(d.lastUsedAt).toLocaleString() : '-', <GlassButton key={d.id} variant="secondary" onClick={()=>revoke(d.id)}>Revoke</GlassButton> ])

  return (
    <AppShell title="Settings: Security">
      <GlassCard title="Multi-Factor Authentication">
        <div className="grid" style={{ gap:12 }}>
          <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
            <div className="label">Status: {mfa?.isEnabled ? 'On' : 'Off'}</div>
            <div className="row" style={{ gap:8 }}>
              <GlassButton variant="primary" onClick={enable} style={{ background:'#39FF14', borderColor:'#39FF14' }}>Enable MFA</GlassButton>
              <GlassButton variant="secondary" onClick={disable}>Disable MFA</GlassButton>
            </div>
          </div>
          <div className="row" style={{ gap:8 }}>
            <GlassButton variant="secondary" onClick={setupEmailOtp}>Configure Email OTP</GlassButton>
            <GlassButton variant="secondary" onClick={setupTotp}>Configure TOTP</GlassButton>
          </div>
          {mfa?.mfaType === 'totp' && (totpSecret || otpauthUri) && (
            <div className="grid" style={{ gap:8 }}>
              <div className="label">Scan QR in your authenticator</div>
              {otpauthUri && (
                <img alt="TOTP QR" src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(otpauthUri)}`} style={{ width:180, height:180, borderRadius:16, border:'1px solid rgba(255,255,255,0.35)' }} />
              )}
              <div className="subtitle">Secret: {totpSecret}</div>
            </div>
          )}
          <div className="subtitle">Org requires MFA: {requireMfa ? 'Yes' : 'No'}</div>
          <div className="subtitle">Login email: {email || '-'}</div>
        </div>
      </GlassCard>

      <GlassCard title="Trusted Devices">
        <GlassTable columns={columns} rows={rows} />
      </GlassCard>
    </AppShell>
  )
}
