'use client'
import { useState } from 'react'
import Card from '@components/Card'
import GlassButton from '@components/ui/GlassButton'
import Toast from '@components/Toast'

export default function OrgInviteCreatePage({ params }: { params: { token: string } }) {
  const [form, setForm] = useState({ orgName:'', ownerName:'', ownerEmail:'', billingEmail:'', pricePerLogin:5, totalLicensedSeats:10, subscriptionType:'monthly', orgPassword:'', orgLogo:'' })
  const [toast, setToast] = useState<{m?:string,t?:'success'|'error'}>({})
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async () => {
    if (loading || done) return
    setLoading(true)
    const payload = { ...form, invite_token: params.token }
    const res = await fetch('/api/org/create', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    const data = await res.json()
    if (res.ok) { setToast({ m:'Organization created', t:'success' }); setDone(true) }
    else setToast({ m: data.error || 'Error', t:'error' })
    setLoading(false)
  }

  return (
    <div className="grid" style={{maxWidth:800, margin:'40px auto'}}>
      <Card title="Create Organization">
        <div className="grid grid-2">
          <div>
            <div className="label">Organization Logo</div>
            <div className="row" style={{gap:12}}>
              <div style={{width:48,height:48,borderRadius:12,background:'#111',border:'1px solid var(--border)',overflow:'hidden'}}>
                {form.orgLogo && <img src={form.orgLogo} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />}
              </div>
              <input type="file" accept="image/*" onChange={async (e)=>{ const f = e.target.files?.[0]; if(!f) return; const reader = new FileReader(); reader.onload = () => setForm({...form, orgLogo: String(reader.result||'')}); reader.readAsDataURL(f) }} />
            </div>
          </div>
          <div>
            <div className="label">Org Name</div>
            <input className="input" value={form.orgName} onChange={e=>setForm({...form, orgName:e.target.value})} />
          </div>
          <div>
            <div className="label">Owner Name</div>
            <input className="input" value={form.ownerName} onChange={e=>setForm({...form, ownerName:e.target.value})} />
          </div>
          <div>
            <div className="label">Owner Email</div>
            <input className="input" value={form.ownerEmail} onChange={e=>setForm({...form, ownerEmail:e.target.value})} />
          </div>
          <div>
            <div className="label">Billing Email</div>
            <input className="input" value={form.billingEmail} onChange={e=>setForm({...form, billingEmail:e.target.value})} />
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
          <div>
            <div className="label">Organization Password (optional)</div>
            <input className="input" type="password" value={form.orgPassword} onChange={e=>setForm({...form, orgPassword:e.target.value})} />
          </div>
        </div>
        <div className="row" style={{marginTop:16,gap:12,justifyContent:'flex-end'}}>
          <GlassButton variant="primary" onClick={submit} style={{ opacity: loading ? 0.6 : 1, pointerEvents: loading ? 'none' : 'auto' }}>{loading? 'Creating…' : done ? 'Created' : 'Create Organization'}</GlassButton>
        </div>
      </Card>
      <Toast message={toast.m} type={toast.t} />
    </div>
  )
}
