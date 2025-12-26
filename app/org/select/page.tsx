'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'

type Org = { id: string, orgName: string }

export default function OrgSelectPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (oid?: string) => {
    const target = oid || orgId
    if (!target) { setError('Select an organization'); return }
    setLoading(true)
    setError('')
    const r = await fetch('/api/orgs/switch', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ org_id: target }) })
    if (!r.ok) { setError('Unable to switch organization'); setLoading(false); return }
    window.location.href = '/'
  }

  const load = async () => {
    const r = await fetch('/api/orgs/my', { cache:'no-store' })
    const d = await r.json()
    const list = d.items || []
    setOrgs(list)
    if (list.length === 1) {
       setOrgId(list[0].id)
       submit(list[0].id)
    } else if (!orgId && list.length) {
       setOrgId(list[0].id)
    }
  }

  useEffect(()=>{ load() }, [])

  return (
    <AppShell title="Select Organization">
      <GlassCard title="Choose your org">
        <div className="grid grid-2">
          <div>
            <div className="label">Organization</div>
            <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
          </div>
          <div className="row" style={{alignItems:'end',gap:8}}>
            <GlassButton variant="primary" onClick={submit}>{loading? 'Switching…' : 'Continue'}</GlassButton>
            {error && <span className="subtitle">{error}</span>}
          </div>
        </div>
      </GlassCard>
    </AppShell>
  )
}
