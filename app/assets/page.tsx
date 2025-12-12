"use client"
import { useEffect, useMemo, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassTable from '@components/ui/GlassTable'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import GlassModal from '@components/ui/GlassModal'
import { normalizeRoleForApi } from '@lib/permissions'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string }
type AssetRow = { id: string, asset_tag: string, category: string, model?: string | null, status: string, assigned_to?: string | null }

export default function AssetsDashboard() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState<string>('')
  const [members, setMembers] = useState<User[]>([])
  const [items, setItems] = useState<AssetRow[]>([])
  const [category, setCategory] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [openCreate, setOpenCreate] = useState(false)
  const [newAsset, setNewAsset] = useState<any>({ asset_tag:'', category:'laptop', model:'', serial_number:'', purchase_date:'', warranty_end:'', status:'in_stock' })
  const [assigningId, setAssigningId] = useState<string>('')
  const [assignMemberId, setAssignMemberId] = useState<string>('')
  const role = typeof document !== 'undefined' ? normalizeRoleForApi(document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_role='))?.split('=')[1] || '') : ''

  const loadOrgs = async () => {
    const r = await fetch('/api/org/list', { cache:'no-store', headers:{ 'x-user-id':'admin' } })
    const d = await r.json()
    setOrgs(d.items||[])
    if (!orgId && d.items?.length) setOrgId(d.items[0].id)
  }
  const loadMembers = async (oid: string) => {
    if (!oid) return
    const r = await fetch(`/api/user/list?orgId=${oid}`, { cache:'no-store' })
    const d = await r.json()
    setMembers(d.items||[])
  }
  const loadAssets = async (oid: string) => {
    if (!oid) return setItems([])
    const params = new URLSearchParams()
    params.set('org_id', oid)
    if (status) params.set('status', status)
    if (category) params.set('category', category)
    const r = await fetch(`/api/assets/list?${params.toString()}`, { cache:'no-store' })
    const d = await r.json()
    setItems(d.items||[])
  }

  useEffect(()=>{ loadOrgs() }, [])
  useEffect(()=>{ loadMembers(orgId); loadAssets(orgId) }, [orgId, status, category])

  const onCreate = async () => {
    if (!orgId || !newAsset.asset_tag || !newAsset.category || !newAsset.status) return
    const body = { ...newAsset, org_id: orgId }
    await fetch('/api/assets/create', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-role': role || 'admin' }, body: JSON.stringify(body) })
    setOpenCreate(false)
    setNewAsset({ asset_tag:'', category:'laptop', model:'', serial_number:'', purchase_date:'', warranty_end:'', status:'in_stock' })
    loadAssets(orgId)
  }

  const onAssign = async () => {
    if (!assigningId || !assignMemberId) return
    await fetch('/api/assets/assign', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-role': role || 'admin' }, body: JSON.stringify({ asset_id: assigningId, member_id: assignMemberId }) })
    setAssigningId('')
    setAssignMemberId('')
    loadAssets(orgId)
  }

  const onReturn = async (assetId: string) => {
    await fetch('/api/assets/return', { method:'POST', headers:{ 'Content-Type':'application/json', 'x-role': role || 'admin' }, body: JSON.stringify({ asset_id: assetId }) })
    loadAssets(orgId)
  }

  const columns = ['Asset Tag','Category','Model','Status','Assigned To','Actions']
  const rows = items.map(a => [
    a.asset_tag,
    a.category,
    a.model || '',
    a.status,
    (()=>{ const m = members.find(mm => mm.id === a.assigned_to); return m ? `${m.firstName} ${m.lastName}` : '' })(),
    <div key={a.id} className="row" style={{gap:8}}>
      {!a.assigned_to ? (
        <>
          <GlassSelect value={assigningId===a.id? assignMemberId:''} onChange={(e:any)=>{ setAssigningId(a.id); setAssignMemberId(e.target.value) }}>
            <option value="">Assign to member</option>
            {members.map(m=> <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
          </GlassSelect>
          <GlassButton variant="primary" onClick={onAssign}>Assign</GlassButton>
        </>
      ) : (
        <GlassButton variant="secondary" onClick={()=> onReturn(a.id)}>Return</GlassButton>
      )}
    </div>
  ])

  return (
    <AppShell title="Assets">
      <div className="col" style={{ gap: 16 }}>
        <GlassCard title="Filters" right={<div className="row" style={{gap:8}}>
          <GlassButton variant="primary" onClick={()=> setOpenCreate(true)}>Create Asset</GlassButton>
        </div>}>
          <div className="grid grid-4">
            <div>
              <div className="label">Organization</div>
              <GlassSelect value={orgId} onChange={(e:any)=> setOrgId(e.target.value)}>
                <option value="">Select org</option>
                {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
              </GlassSelect>
            </div>
            <div>
              <div className="label">Category</div>
              <GlassSelect value={category} onChange={(e:any)=> setCategory(e.target.value)}>
                <option value="">All</option>
                <option value="laptop">Laptop</option>
                <option value="monitor">Monitor</option>
                <option value="phone">Phone</option>
                <option value="license">License</option>
                <option value="other">Other</option>
              </GlassSelect>
            </div>
            <div>
              <div className="label">Status</div>
              <GlassSelect value={status} onChange={(e:any)=> setStatus(e.target.value)}>
                <option value="">All</option>
                <option value="in_use">In Use</option>
                <option value="in_stock">In Stock</option>
                <option value="retired">Retired</option>
                <option value="lost">Lost</option>
              </GlassSelect>
            </div>
            <div className="row" style={{alignItems:'end',gap:8}}>
              <GlassButton variant="secondary" onClick={()=> loadAssets(orgId)}>Refresh</GlassButton>
            </div>
          </div>
        </GlassCard>

        <GlassCard title="Assets List">
          <GlassTable columns={columns} rows={rows} />
        </GlassCard>

        <GlassModal open={openCreate} title="Create Asset" onClose={()=> setOpenCreate(false)}>
          <div className="grid grid-2">
            <div>
              <div className="label">Asset Tag</div>
              <input className="input" value={newAsset.asset_tag} onChange={e=> setNewAsset({...newAsset, asset_tag: e.target.value})} />
            </div>
            <div>
              <div className="label">Category</div>
              <GlassSelect value={newAsset.category} onChange={(e:any)=> setNewAsset({...newAsset, category: e.target.value})}>
                <option value="laptop">Laptop</option>
                <option value="monitor">Monitor</option>
                <option value="phone">Phone</option>
                <option value="license">License</option>
                <option value="other">Other</option>
              </GlassSelect>
            </div>
            <div>
              <div className="label">Model</div>
              <input className="input" value={newAsset.model} onChange={e=> setNewAsset({...newAsset, model: e.target.value})} />
            </div>
            <div>
              <div className="label">Serial Number</div>
              <input className="input" value={newAsset.serial_number} onChange={e=> setNewAsset({...newAsset, serial_number: e.target.value})} />
            </div>
            <div>
              <div className="label">Purchase Date</div>
              <input className="input" type="date" value={newAsset.purchase_date} onChange={e=> setNewAsset({...newAsset, purchase_date: e.target.value})} />
            </div>
            <div>
              <div className="label">Warranty End</div>
              <input className="input" type="date" value={newAsset.warranty_end} onChange={e=> setNewAsset({...newAsset, warranty_end: e.target.value})} />
            </div>
            <div>
              <div className="label">Status</div>
              <GlassSelect value={newAsset.status} onChange={(e:any)=> setNewAsset({...newAsset, status: e.target.value})}>
                <option value="in_stock">In Stock</option>
                <option value="in_use">In Use</option>
                <option value="retired">Retired</option>
                <option value="lost">Lost</option>
              </GlassSelect>
            </div>
            <div className="row" style={{alignItems:'end',gap:8}}>
              <GlassButton variant="primary" onClick={onCreate}>Create</GlassButton>
            </div>
          </div>
        </GlassModal>
      </div>
    </AppShell>
  )
}
