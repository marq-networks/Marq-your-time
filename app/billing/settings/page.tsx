"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassInput from '@components/ui/GlassInput'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'
import { CreditCard, Mail, Building, Save, ShieldCheck, Landmark, AlertCircle } from 'lucide-react'

export default function BillingSettingsPage() {
  const [orgs, setOrgs] = useState<any[]>([])
  const [orgId, setOrgId] = useState('')
  const [billingEmail, setBillingEmail] = useState('')
  const [methodType, setMethodType] = useState('card')
  const [methodToken, setMethodToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  const loadOrgs = async () => { 
    try {
      const res = await fetch('/api/org/list', { cache:'no-store', headers:{ 'x-user-id':'admin' }})
      const d = await res.json()
      setOrgs(d.items||[])
      if(!orgId && d.items?.length) setOrgId(d.items[0].id)
    } catch (e) {
      console.error("Failed to load orgs", e)
    }
  }
  
  useEffect(()=>{ loadOrgs() }, [])

  const save = async () => { 
    setLoading(true)
    setSuccess('')
    try {
      const res = await fetch('/api/billing/saveSettings', { 
        method:'POST', 
        headers:{ 'Content-Type':'application/json','x-user-id':'admin' }, 
        body: JSON.stringify({ orgId, billingEmail, paymentMethodType: methodType, paymentMethodToken: methodToken }) 
      })
      if (res.ok) {
        setSuccess('Settings saved successfully')
        setTimeout(() => setSuccess(''), 3000)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell title="Billing Settings">
      <div className="max-w-4xl mx-auto space-y-6">
        <GlassCard className="relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <CreditCard size={120} className="text-indigo-600" />
          </div>
          
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="p-3 bg-indigo-50 rounded-xl">
              <CreditCard className="text-indigo-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Payment Configuration</h2>
              <p className="text-slate-500 text-sm">Manage your billing details and payment methods</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Building size={14} /> Organization
              </label>
              <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)} className="w-full">
                <option value="">Select Organization</option>
                {orgs.map((o:any)=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
              </GlassSelect>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Mail size={14} /> Billing Email
              </label>
              <GlassInput 
                value={billingEmail} 
                onChange={e=>setBillingEmail(e.target.value)} 
                placeholder="billing@company.com"
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Landmark size={14} /> Payment Method
              </label>
              <GlassSelect value={methodType} onChange={(e:any)=>setMethodType(e.target.value)} className="w-full">
                <option value="card">Credit Card</option>
                <option value="bank">Bank Transfer</option>
                <option value="other">Other</option>
              </GlassSelect>
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck size={14} /> Method Token / ID
              </label>
              <GlassInput 
                value={methodToken} 
                onChange={e=>setMethodToken(e.target.value)} 
                type="password"
                placeholder="•••• •••• •••• ••••"
                className="w-full"
              />
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <AlertCircle size={10} />
                Encrypted and stored securely
              </p>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
            <div className="text-sm text-slate-500">
              {success && <span className="text-emerald-600 font-medium flex items-center gap-2"><ShieldCheck size={16} /> {success}</span>}
            </div>
            <GlassButton 
              onClick={save} 
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-lg shadow-indigo-200 flex items-center gap-2 px-6"
            >
              {loading ? 'Saving...' : <><Save size={16} /> Save Settings</>}
            </GlassButton>
          </div>
        </GlassCard>
      </div>
    </AppShell>
  )
}

