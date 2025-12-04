'use client'
import { useEffect, useMemo, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassSelect from '@components/ui/GlassSelect'
import GlassButton from '@components/ui/GlassButton'
import GlassTable from '@components/ui/GlassTable'
import GlassModal from '@components/ui/GlassModal'

type Org = { id: string, orgName: string }
type Batch = { local_batch_id: string, batch_type: string, status: string, item_count: number, received_at: string, processed_at: string|null, error_message: string|null }
type Conflict = { id: string, conflict_type: string, created_at: string, device_id: string, member_id: string, org_id: string }

export default function OfflineSyncPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [limit, setLimit] = useState(50)
  const [batches, setBatches] = useState<Batch[]>([])
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [openQueueId, setOpenQueueId] = useState<string|null>(null)
  const [items, setItems] = useState<{ item_index: number, payload_type: string, payload: any }[]>([])

  useEffect(() => { (async () => { const res = await fetch('/api/org/list'); const j = await res.json(); setOrgs(j.orgs || []) })() }, [])

  const loadStatus = async () => {
    if (!orgId) return
    const params = new URLSearchParams()
    params.set('org_id', orgId)
    if (deviceId) params.set('device_id', deviceId)
    params.set('limit', String(limit))
    const res = await fetch(`/api/agent/offline/status?${params.toString()}`)
    const j = await res.json()
    setBatches(j.batches || [])
    setConflicts(j.conflicts || [])
  }

  useEffect(() => { if (orgId) loadStatus() }, [orgId, deviceId, limit])

  const deviceOptions = useMemo(() => {
    const ids = Array.from(new Set((batches || []).map(b => (b as any).device_id).filter(Boolean)))
    return ids.map(id => ({ id, label: id }))
  }, [batches])

  const filteredBatches = useMemo(() => {
    if (!rangeStart && !rangeEnd) return batches
    const s = rangeStart ? new Date(rangeStart + 'T00:00:00').getTime() : 0
    const e = rangeEnd ? new Date(rangeEnd + 'T23:59:59').getTime() : Number.MAX_SAFE_INTEGER
    return batches.filter(b => { const t = new Date(b.received_at).getTime(); return t >= s && t <= e })
  }, [batches, rangeStart, rangeEnd])

  const stats = useMemo(() => {
    const total = filteredBatches.length
    const pending = filteredBatches.filter(b => b.status === 'pending').length
    const applied = filteredBatches.filter(b => b.status === 'applied').length
    const error = filteredBatches.filter(b => b.status === 'error').length
    const conflictCount = conflicts.length
    return { total, pending, applied, error, conflictCount }
  }, [filteredBatches, conflicts])

  const batchCols = ['Local Batch ID','Type','Items','Status','Received','Processed','Error','Actions']

  const conflictCols = ['Type','Device','Member','Created At','Actions']

  const openItems = async (queueId: string) => {
    const res = await fetch(`/api/agent/offline/items?sync_queue_id=${encodeURIComponent(queueId)}`)
    const j = await res.json()
    setItems(j.items || [])
    setOpenQueueId(queueId)
  }

  return (
    <AppShell title="Offline Sync">
      <div className="min-h-screen bg-gradient-to-br from-[#d9c7b2] via-[#e8ddce] to-[#c9b8a4] p-6">
        <GlassCard title="Filters">
          <div className="grid grid-3" style={{ gap: 12 }}>
            <div>
              <div className="label">Organization</div>
              <GlassSelect value={orgId} onChange={(e:any)=>setOrgId(e.target.value)}>
                <option value="">Select org</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.orgName}</option>)}
              </GlassSelect>
            </div>
            <div>
              <div className="label">Device</div>
              <GlassSelect value={deviceId} onChange={(e:any)=>setDeviceId(e.target.value)}>
                <option value="">All devices</option>
                {deviceOptions.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </GlassSelect>
            </div>
            <div className="row" style={{ alignItems:'end', gap: 8 }}>
              <div>
                <div className="label">Start</div>
                <input type="date" value={rangeStart} onChange={(e)=>setRangeStart(e.target.value)} />
              </div>
              <div>
                <div className="label">End</div>
                <input type="date" value={rangeEnd} onChange={(e)=>setRangeEnd(e.target.value)} />
              </div>
              <GlassButton onClick={loadStatus} style={{ backgroundColor:'#39FF14' }}>Refresh</GlassButton>
            </div>
          </div>
        </GlassCard>

        <div className="grid grid-3" style={{ gap: 16, marginTop: 16 }}>
          <GlassCard title="Total Batches"><div>{stats.total}</div></GlassCard>
          <GlassCard title="Pending"><div>{stats.pending}</div></GlassCard>
          <GlassCard title="Applied"><div>{stats.applied}</div></GlassCard>
          <GlassCard title="Errors"><div>{stats.error}</div></GlassCard>
          <GlassCard title="Conflicts"><div>{stats.conflictCount}</div></GlassCard>
        </div>

        <div style={{ marginTop: 16 }}>
          <GlassCard title="Batches">
            <GlassTable columns={batchCols} rows={filteredBatches.map(b => [
              b.local_batch_id,
              b.batch_type,
              String(b.item_count),
              b.status,
              b.received_at,
              b.processed_at || '',
              b.error_message || '',
              <GlassButton key={`open-${b.local_batch_id}`} onClick={()=>openItems((b as any).id)} style={{ backgroundColor:'#39FF14' }}>View Items</GlassButton>
            ])} />
          </GlassCard>
        </div>

        <div style={{ marginTop: 16 }}>
          <GlassCard title="Conflicts">
            <GlassTable columns={conflictCols} rows={conflicts.map(c => [
              c.conflict_type,
              c.device_id,
              c.member_id,
              c.created_at,
              <GlassButton key={`resolve-${c.id}`} onClick={async()=>{ await fetch('/api/agent/offline/conflicts/resolve', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ conflict_id: c.id, resolution_note: 'Resolved by admin' }) }); loadStatus() }} style={{ backgroundColor:'#39FF14' }}>Mark Resolved</GlassButton>
            ])} />
          </GlassCard>
        </div>

        <GlassModal open={!!openQueueId} title={`Batch ${openQueueId || ''}`} onClose={()=>setOpenQueueId(null)}>
          <div style={{ maxHeight: 360, overflow:'auto' }}>
            <pre>{JSON.stringify(items, null, 2)}</pre>
          </div>
        </GlassModal>
      </div>
    </AppShell>
  )
}
