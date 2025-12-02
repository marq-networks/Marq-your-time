'use client'
import { useState } from 'react'
import Card from '@components/Card'
import Toast from '@components/Toast'
import { usePathname } from 'next/navigation'
import AppShell from '@components/ui/AppShell'

export default function LandingLink() {
  const id = usePathname().split('/')[2] || ''
  const [form, setForm] = useState({ priceOverride: '', prefillEmail: '' })
  const [result, setResult] = useState<any>()
  const [toast, setToast] = useState<{m?:string,t?:'success'|'error'}>({})

  const generate = async () => {
    const res = await fetch(`/api/org/${id}/landing-link`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ priceOverride: form.priceOverride ? Number(form.priceOverride) : undefined, prefillEmail: form.prefillEmail || undefined }) })
    const data = await res.json()
    if (res.ok) { setResult(data); setToast({ m:'Link generated', t:'success' }) } else setToast({ m:data.error || 'Error', t:'error' })
  }

  return (
    <AppShell title="Invite Link Generator">
      <Card title="Invite Link Generator">
        <div className="grid grid-2">
          <div>
            <div className="label">Price per login (override)</div>
            <input className="input" value={form.priceOverride} onChange={e=>setForm({...form,priceOverride:e.target.value})} />
          </div>
          <div>
            <div className="label">Pre-filled email (optional)</div>
            <input className="input" value={form.prefillEmail} onChange={e=>setForm({...form,prefillEmail:e.target.value})} />
          </div>
        </div>
        <div className="row" style={{marginTop:12}}>
          <button className="btn btn-primary" onClick={generate}>Generate</button>
        </div>
        {result && (
          <div className="card" style={{marginTop:12}}>
            <div className="title">{result.url}</div>
            <div className="subtitle">Price {result.orgConfig.pricePerLogin} • Seats {result.orgConfig.totalLicensedSeats}</div>
            {result.prefillEmail && <div className="subtitle">Prefill {result.prefillEmail}</div>}
          </div>
        )}
      </Card>
      <Toast message={toast.m} type={toast.t} />
    </AppShell>
  )
}
