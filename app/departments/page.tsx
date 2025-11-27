'use client'
import { useEffect, useState } from 'react'
import Card from '@components/Card'
import Table from '@components/Table'
import Modal from '@components/Modal'
import Toast from '@components/Toast'

type Org = { id: string, orgName: string }
type Department = { id: string, name: string, createdAt: number }
type User = { id: string, departmentId?: string }

export default function DepartmentsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [toast, setToast] = useState<{m?:string,t?:'success'|'error'}>({})
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')

  const loadOrgs = async () => {
    const res = await fetch('/api/org/list', { cache: 'no-store' })
    const data = await res.json()
    setOrgs(data.items || [])
    if (!orgId && data.items?.length) setOrgId(data.items[0].id)
  }
  const loadData = async (oid: string) => {
    if (!oid) return
    const [dRes, uRes] = await Promise.all([
      fetch(`/api/department/list?orgId=${oid}`, { cache: 'no-store' }),
      fetch(`/api/user/list?orgId=${oid}`, { cache: 'no-store' })
    ])
    const [d, u] = await Promise.all([dRes.json(), uRes.json()])
    setDepartments(d.items || [])
    setUsers(u.items || [])
  }

  useEffect(() => { loadOrgs() }, [])
  useEffect(() => { if (orgId) loadData(orgId) }, [orgId])

  const membersCount = (id: string) => users.filter(u => u.departmentId === id).length

  const create = async () => {
    const res = await fetch('/api/department/create', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orgId, name: newName }) })
    const data = await res.json()
    if (res.ok) { setCreateOpen(false); setNewName(''); setToast({ m:'Department created', t:'success' }); loadData(orgId) }
    else setToast({ m: data.error || 'Error', t:'error' })
  }

  const rename = async (id: string, name: string) => {
    const res = await fetch(`/api/department/${id}/update`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name }) })
    const data = await res.json()
    if (res.ok) { setToast({ m:'Department renamed', t:'success' }); loadData(orgId) }
    else setToast({ m: data.error || 'Error', t:'error' })
  }

  const del = async (id: string) => {
    const res = await fetch(`/api/department/${id}/delete`, { method:'POST' })
    const data = await res.json()
    if (res.ok) { setToast({ m:'Department deleted', t:'success' }); loadData(orgId) }
    else setToast({ m: data.error || 'Error', t:'error' })
  }

  const columns = ['Name','Members Count','CreatedAt','Actions']
  const rows = departments.map(d => [
    d.name,
    membersCount(d.id),
    new Date(d.createdAt).toLocaleString(),
    <div className="row" style={{gap:8}}>
      <button className="btn" onClick={()=>{
        const name = prompt('New name', d.name) || ''
        if (name) rename(d.id, name)
      }}>Rename</button>
      <button className="btn" onClick={()=>del(d.id)}>Delete</button>
    </div>
  ])

  return (
    <div className="grid">
      <Card title="Departments" right={<button className="btn btn-primary" onClick={()=>setCreateOpen(true)}>Add Department</button>}>
        <div className="row" style={{marginBottom:12,gap:12}}>
          <div>
            <div className="label">Organization</div>
            <select className="input" value={orgId} onChange={e=>setOrgId(e.target.value)}>
              <option value="">Select org</option>
              {orgs.map(o=> <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </select>
          </div>
        </div>
        <Table columns={columns} rows={rows} />
      </Card>

      <Modal open={createOpen} title="Create Department" onClose={()=>setCreateOpen(false)}>
        <div>
          <div className="label">Name</div>
          <input className="input" value={newName} onChange={e=>setNewName(e.target.value)} />
        </div>
        <div className="row" style={{marginTop:12}}>
          <button className="btn btn-primary" onClick={create}>Create</button>
        </div>
      </Modal>

      <Toast message={toast.m} type={toast.t} />
    </div>
  )
}
