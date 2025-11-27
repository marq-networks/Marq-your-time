'use client'
import { useState } from 'react'
import Card from '@components/Card'
import Toast from '@components/Toast'

export default function CreateOrg() {
  const [form, setForm] = useState({ orgName:'', ownerName:'', ownerEmail:'', billingEmail:'', pricePerLogin:5, totalLicensedSeats:10, subscriptionType:'monthly' })
  const [toast, setToast] = useState<{m?:string,t?:'success'|'error'}>({})
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    const res = await fetch('/api/org/create', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
    const data = await res.json()
    if (res.ok) setToast({ m:'Organization created', t:'success' })
    else setToast({ m: data.error || 'Error', t:'error' })
    setLoading(false)
  }

  const bind = (k: string) => ({ value: (form as any)[k], onChange: (e: any) => setForm({ ...form, [k]: e.target.value }) })

  return (
    <div className="grid">
      <Card title="Create Organization">
        <div className="grid grid-2">
          <div>
            <div className="label">Org Name</div>
            <input className="input" {...bind('orgName')} />
          </div>
          <div>
            <div className="label">Owner Name</div>
            <input className="input" {...bind('ownerName')} />
          </div>
          <div>
            <div className="label">Owner Email</div>
            <input className="input" {...bind('ownerEmail')} />
          </div>
          <div>
            <div className="label">Billing Email</div>
            <input className="input" {...bind('billingEmail')} />
          </div>
          <div>
            <div className="label">Price per login</div>
            <input className="input" type="number" value={form.pricePerLogin} onChange={e=>setForm({...form, pricePerLogin:Number(e.target.value)})} />
          </div>
          <div>
            <div className="label">Total licensed seats</div>
            <input className="input" type="number" value={form.totalLicensedSeats} onChange={e=>setForm({...form, totalLicensedSeats:Number(e.target.value)})} />
          </div>
          <div>
            <div className="label">Subscription</div>
            <select className="input" value={form.subscriptionType} onChange={e=>setForm({...form, subscriptionType:e.target.value})}>
              <option value="monthly">monthly</option>
              <option value="yearly">yearly</option>
            </select>
          </div>
        </div>
        <div className="row" style={{marginTop:16}}>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>Create Organization</button>
          <a className="btn" href="/org/list">Cancel</a>
        </div>
      </Card>
      <Toast message={toast.m} type={toast.t} />
    </div>
  )
}
