'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassInput from '@components/ui/GlassInput'
import GlassSelect from '@components/ui/GlassSelect'

type AuditItem = {
  id: string
  orgId: string
  actorUserId?: string
  actorIp?: string
  actorUserAgent?: string
  eventType: string
  entityType?: string
  entityId?: string
  metadata?: any
  createdAt: number
}

export default function AuditLogPage() {
  const [orgId, setOrgId] = useState('')
  const [items, setItems] = useState<AuditItem[]>([])
  const [eventType, setEventType] = useState('')
  const [actorId, setActorId] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [cursor, setCursor] = useState<string | null>(null)

  const load = async (reset = true) => {
    if (!orgId) return
    const params = new URLSearchParams()
    params.set('org_id', orgId)
    if (eventType) params.set('event_type', eventType)
    if (actorId) params.set('actor_user_id', actorId)
    if (dateStart) params.set('date_start', dateStart)
    if (dateEnd) params.set('date_end', dateEnd)
    if (!reset && cursor) params.set('cursor', cursor)
    const res = await fetch(`/api/audit/logs?${params.toString()}`)
    const data = await res.json()
    const rows: AuditItem[] = (data.items || []).map((r: any) => ({
      id: r.id,
      orgId: r.org_id || r.orgId,
      actorUserId: r.actor_user_id || r.actorUserId,
      actorIp: r.actor_ip || r.actorIp,
      actorUserAgent: r.actor_user_agent || r.actorUserAgent,
      eventType: r.event_type || r.eventType,
      entityType: r.entity_type || r.entityType,
      entityId: r.entity_id || r.entityId,
      metadata: r.metadata,
      createdAt: Number(r.created_at ? new Date(r.created_at).getTime() : r.createdAt || Date.now())
    }))
    setItems(reset ? rows : [...items, ...rows])
    setCursor(data.nextCursor || null)
  }

  useEffect(() => {
    const oid = (localStorage.getItem('org_id') || localStorage.getItem('orgId') || '')
    if (oid) { setOrgId(oid) }
  }, [])

  useEffect(() => { if (orgId) load(true) }, [orgId, eventType, actorId, dateStart, dateEnd])

  return (
    <AppShell title="Audit Log">
      <div style={{display:'grid', gap:16}}>
        <GlassCard title="Filters" right={<button onClick={()=>load(true)} style={{padding:'8px 12px'}}>Apply</button>}>
          <div style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:12}}>
            <GlassInput placeholder="Event type (e.g., payroll.approved)" value={eventType} onChange={e=>setEventType(e.target.value)} />
            <GlassInput placeholder="Actor user id" value={actorId} onChange={e=>setActorId(e.target.value)} />
            <GlassInput placeholder="Date start (YYYY-MM-DD)" value={dateStart} onChange={e=>setDateStart(e.target.value)} />
            <GlassInput placeholder="Date end (YYYY-MM-DD)" value={dateEnd} onChange={e=>setDateEnd(e.target.value)} />
            <GlassSelect value={''} onChange={()=>{}}>
              <option value="">Read-only</option>
            </GlassSelect>
          </div>
        </GlassCard>

        <GlassCard title="Audit Events" right={cursor ? <button onClick={()=>load(false)} style={{padding:'8px 12px'}}>Load more</button> : undefined}>
          <GlassTable columns={[
            'Time','Actor','Event','Entity','Metadata'
          ]} rows={items.map((it)=>[
            new Date(it.createdAt).toLocaleString(),
            it.actorUserId || '-',
            it.eventType,
            `${it.entityType || ''}${it.entityId ? ':'+it.entityId : ''}`,
            <span key={`m-${it.id}`} title={JSON.stringify(it.metadata||{})}>{JSON.stringify(it.metadata||{}).slice(0,80)}</span>
          ])} />
        </GlassCard>
      </div>
    </AppShell>
  )
}
