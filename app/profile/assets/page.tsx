"use client"
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'

type Item = { asset_tag: string, category: string, model?: string | null, assigned_at: string }

export default function MyAssetsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [memberId, setMemberId] = useState<string>('demo-user')

  const load = async () => {
    if (!memberId) return setItems([])
    const r = await fetch(`/api/assets/member?member_id=${memberId}`, { cache:'no-store', headers:{ 'x-user-id': memberId } })
    const d = await r.json()
    setItems(d.items||[])
  }

  useEffect(()=>{ load() }, [memberId])

  return (
    <AppShell title="My Assets">
      <div className="col" style={{ gap: 16 }}>
        <GlassCard title="Assigned Assets" right={<div className="row" style={{gap:8}}>
          <input className="input" value={memberId} onChange={e=> setMemberId(e.target.value)} placeholder="Member ID" />
          <GlassButton variant="secondary" onClick={load}>Refresh</GlassButton>
        </div>}>
          <div className="grid-1" style={{ gap: 12 }}>
            {items.map((it,i)=> (
              <div key={`${it.asset_tag}-${i}`} className="glass-panel" style={{ padding: 12, borderRadius: 16 }}>
                <div className="row" style={{ gap: 12, alignItems:'center' }}>
                  <span className="tag-pill accent">{it.asset_tag}</span>
                  <span className="badge">{it.category}</span>
                  <span className="subtitle">{it.model || ''}</span>
                  <span className="subtitle">Assigned {new Date(it.assigned_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
            {!items.length && <div className="subtitle">No assets assigned.</div>}
          </div>
        </GlassCard>
      </div>
    </AppShell>
  )
}

