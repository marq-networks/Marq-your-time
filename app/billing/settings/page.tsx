"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassInput from '@components/ui/GlassInput'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'

export default function BillingSettingsPage() {
  const [orgs, setOrgs] = useState<any[]>([])
  const [orgId, setOrgId] = useState('')
  const [billingEmail, setBillingEmail] = useState('')
  const [methodType, setMethodType] = useState('card')
  const [methodToken, setMethodToken] = useState('')

  const loadOrgs = async () => { const res = await fetch('/api/org/list', { cache:'no-store', headers:{ 'x-user-id':'admin' }}); const d = await res.json(); setOrgs(d.items||[]); if(!orgId && d.items?.length) setOrgId(d.items[0].id) }
  useEffect(()=>{ loadOrgs() }, [])

  const save = async () => { await fetch('/api/billing/saveSettings', { method:'POST', headers:{ 'Content-Type':'application/json','x-user-id':'admin' }, body: JSON.stringify({ orgId, billingEmail, paymentMethodType: methodType, paymentMethodToken: methodToken }) }) }

  return (
    <AppShell title="Billing Settings">
      <GlassCard title="Payment Method">
        <div className="grid grid-3">
          <div>
            <div className="label">Organization</div>
            <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map((o:any)=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
          </div>
          <div>
            <div className="label">Billing Email</div>
            <GlassInput value={billingEmail} onChange={e=>setBillingEmail(e.target.value)} />
          </div>
          <div>
            <div className="label">Payment Method</div>
            <GlassSelect value={methodType} onChange={(e:any)=>setMethodType(e.target.value)}>
              <option value="card">Card</option>
              <option value="bank">Bank</option>
              <option value="other">Other</option>
            </GlassSelect>
          </div>
          <div>
            <div className="label">Method Token</div>
            <GlassInput value={methodToken} onChange={e=>setMethodToken(e.target.value)} />
          </div>
        </div>
        <div className="row" style={{marginTop:12}}>
          <GlassButton onClick={save}>Save Settings</GlassButton>
        </div>
      </GlassCard>
    </AppShell>
  )
}

