'use client'
import { useEffect, useMemo, useState } from 'react'
import Card from '@components/Card'
import Table from '@components/Table'
import Modal from '@components/Modal'
import Toast from '@components/Toast'

type Org = { id: string, orgName: string }
type Department = { id: string, name: string }
type Role = { id: string, name: string }
type User = { id: string, firstName: string, lastName: string, email: string, profileImage?: string, roleId?: string, departmentId?: string, status: string }

export default function UsersPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [orgId, setOrgId] = useState<string>('')
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [toast, setToast] = useState<{m?:string,t?:'success'|'error'}>({})
  const [addOpen, setAddOpen] = useState(false)
  const [editUser, setEditUser] = useState<User|undefined>(undefined)
  const [editReadOnly, setEditReadOnly] = useState<boolean>(false)
  const [openMenuId, setOpenMenuId] = useState<string>('')

  const roleName = (id?: string) => roles.find(r=>r.id===id)?.name || '-'
  const deptName = (id?: string) => departments.find(d=>d.id===id)?.name || '-'

  const loadOrgs = async () => {
    const res = await fetch('/api/org/list', { cache: 'no-store' })
    const data = await res.json()
    setOrgs(data.items || [])
    if (!orgId && data.items?.length) setOrgId(data.items[0].id)
  }
  const loadData = async (oid: string) => {
    if (!oid) return
    const [uRes, rRes, dRes] = await Promise.all([
      fetch(`/api/user/list?orgId=${oid}`, { cache:'no-store' }),
      fetch(`/api/role/list?orgId=${oid}`, { cache:'no-store' }),
      fetch(`/api/department/list?orgId=${oid}`, { cache:'no-store' })
    ])
    const [u, r, d] = await Promise.all([uRes.json(), rRes.json(), dRes.json()])
    setUsers(u.items || [])
    setRoles(r.items || [])
    setDepartments(d.items || [])
  }

  useEffect(() => { loadOrgs() }, [])
  useEffect(() => { if (orgId) loadData(orgId) }, [orgId])

  const [form, setForm] = useState({ firstName:'', lastName:'', email:'', salary:'', workingDays: [] as string[], workingHoursPerDay: '', departmentId:'', roleId:'' })
  const emailOk = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email), [form.email])

  const createUser = async () => {
    if (!orgId) { setToast({ m:'Select organization', t:'error' }); return }
    const req = {
      ...form,
      orgId,
      salary: Number(form.salary),
      workingHoursPerDay: Number(form.workingHoursPerDay)
    }
    const res = await fetch('/api/user/create', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(req) })
    const data = await res.json()
    if (res.ok) { setAddOpen(false); setToast({ m:'User created', t:'success' }); setForm({ firstName:'', lastName:'', email:'', salary:'', workingDays: [], workingHoursPerDay: '', departmentId:'', roleId:'' }); loadData(orgId) }
    else setToast({ m: data.error || 'Error', t:'error' })
  }

  const suspend = async (id: string) => {
    const res = await fetch(`/api/user/${id}/suspend`, { method:'POST' })
    const data = await res.json()
    if (res.ok) { setToast({ m:'User suspended', t:'success' }); loadData(orgId) }
    else setToast({ m: data.error || 'Error', t:'error' })
  }

  const activate = async (id: string) => {
    const res = await fetch(`/api/user/${id}/activate`, { method:'POST' })
    const data = await res.json()
    if (res.ok) { setToast({ m:'User activated', t:'success' }); loadData(orgId) }
    else setToast({ m: data.error || 'Error', t:'error' })
  }

  const resetPassword = async (_id: string) => {
    setToast({ m:'Password reset email queued', t:'success' })
  }

  const updateUser = async () => {
    if (!editUser) return
    const payload = {
      departmentId: editUser.departmentId,
      roleId: editUser.roleId,
      salary: (editUser as any).salary,
      workingDays: (editUser as any).workingDays,
      workingHoursPerDay: (editUser as any).workingHoursPerDay,
      status: editUser.status
    }
    const res = await fetch(`/api/user/${editUser.id}/update`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    const data = await res.json()
    if (res.ok) { setToast({ m:'User updated', t:'success' }); setEditUser(undefined); loadData(orgId) }
    else setToast({ m: data.error || 'Error', t:'error' })
  }

  const columns = ['Photo','Name','Email','Role','Department','Status','Actions']
  const rows = users.map(u => [
    <div key={u.id} style={{width:28,height:28,borderRadius:8,background:'#111',border:'1px solid var(--border)'}}></div>,
    `${u.firstName} ${u.lastName}`,
    u.email,
    roleName(u.roleId),
    deptName(u.departmentId),
    <span className="badge">{u.status}</span>,
    <div style={{position:'relative'}}>
      <button className="btn" onClick={()=>setOpenMenuId(openMenuId===u.id?'':u.id)}>Actions ▾</button>
      {openMenuId===u.id && (
        <div style={{position:'absolute',top:'110%',right:0,background:'var(--card)',border:'1px solid var(--border)',borderRadius:12,boxShadow:'var(--shadow)',minWidth:180}}>
          <button className="btn" style={{display:'block',width:'100%',textAlign:'left'}} onClick={()=>{ setEditUser(u); setEditReadOnly(true); setOpenMenuId('') }}>View</button>
          <button className="btn" style={{display:'block',width:'100%',textAlign:'left'}} onClick={()=>{ setEditUser(u); setEditReadOnly(false); setOpenMenuId('') }}>Edit</button>
          {u.status==='suspended' ? (
            <button className="btn" style={{display:'block',width:'100%',textAlign:'left'}} onClick={()=>{ activate(u.id); setOpenMenuId('') }}>Activate</button>
          ) : (
            <button className="btn" style={{display:'block',width:'100%',textAlign:'left'}} onClick={()=>{ suspend(u.id); setOpenMenuId('') }}>Suspend</button>
          )}
          <button className="btn" style={{display:'block',width:'100%',textAlign:'left'}} onClick={()=>{ resetPassword(u.id); setOpenMenuId('') }}>Reset Password</button>
        </div>
      )}
    </div>
  ])

  return (
    <div className="grid">
      <Card title="Users" right={<button className="btn btn-primary" onClick={()=>setAddOpen(true)}>Add User</button>}>
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

      <Modal open={addOpen} title="Create User" onClose={()=>setAddOpen(false)}>
        <div className="grid grid-2">
          <div>
            <div className="label">First name</div>
            <input className="input" value={form.firstName} onChange={e=>setForm({...form, firstName:e.target.value})} />
          </div>
          <div>
            <div className="label">Last name</div>
            <input className="input" value={form.lastName} onChange={e=>setForm({...form, lastName:e.target.value})} />
          </div>
          <div>
            <div className="label">Email</div>
            <input className="input" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
            {!emailOk && form.email ? <div className="subtitle">Invalid email</div> : null}
          </div>
          <div>
            <div className="label">Salary</div>
            <input className="input" type="number" value={form.salary} onChange={e=>setForm({...form, salary:e.target.value})} />
          </div>
          <div>
            <div className="label">Working days (comma)</div>
            <input className="input" value={(form.workingDays as any).join(',')} onChange={e=>setForm({...form, workingDays: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} />
          </div>
          <div>
            <div className="label">Hours per day</div>
            <input className="input" type="number" value={form.workingHoursPerDay} onChange={e=>setForm({...form, workingHoursPerDay:e.target.value})} />
          </div>
          <div>
            <div className="label">Department</div>
            <select className="input" value={form.departmentId} onChange={e=>setForm({...form, departmentId:e.target.value})}>
              <option value="">Select</option>
              {departments.map(d=> <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <div className="label">Role</div>
            <select className="input" value={form.roleId} onChange={e=>setForm({...form, roleId:e.target.value})}>
              <option value="">Select</option>
              {roles.map(r=> <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </div>
        <div className="row" style={{marginTop:12}}>
          <button className="btn btn-primary" onClick={createUser}>Create User</button>
        </div>
      </Modal>

      {editUser && (
        <div style={{position:'fixed',top:0,right:0,bottom:0,width:460,background:'var(--bg-ash)',borderLeft:'1px solid var(--border)',boxShadow:'var(--shadow)'}}>
          <div style={{padding:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div className="title">Edit User</div>
            <button className="btn" onClick={()=>setEditUser(undefined)}>Close</button>
          </div>
          <div style={{padding:16}}>
            <div className="subtitle" style={{marginBottom:12}}>{editUser.email}</div>
            <div className="grid">
              <div>
                <div className="label">Department</div>
                <select className="input" value={editUser.departmentId || ''} onChange={e=>setEditUser({...editUser, departmentId: e.target.value})} disabled={editReadOnly}>
                  <option value="">Select</option>
                  {departments.map(d=> <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <div className="label">Role</div>
                <select className="input" value={editUser.roleId || ''} onChange={e=>setEditUser({...editUser, roleId: e.target.value})} disabled={editReadOnly}>
                  <option value="">Select</option>
                  {roles.map(r=> <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <div className="label">Salary</div>
                <input className="input" type="number" value={(editUser as any).salary || ''} onChange={e=>setEditUser({...editUser, ...(editUser as any), salary: Number(e.target.value) } as any)} disabled={editReadOnly} />
              </div>
              <div>
                <div className="label">Working days (comma)</div>
                <input className="input" value={((editUser as any).workingDays || []).join(',')} onChange={e=>setEditUser({...editUser, ...(editUser as any), workingDays: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)} as any)} disabled={editReadOnly} />
              </div>
              <div>
                <div className="label">Hours per day</div>
                <input className="input" type="number" value={(editUser as any).workingHoursPerDay || ''} onChange={e=>setEditUser({...editUser, ...(editUser as any), workingHoursPerDay: Number(e.target.value)} as any)} disabled={editReadOnly} />
              </div>
              <div>
                <div className="label">Status</div>
                <select className="input" value={editUser.status} onChange={e=>setEditUser({...editUser, status: e.target.value})} disabled={editReadOnly}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="suspended">suspended</option>
                </select>
              </div>
            </div>
            {!editReadOnly && (
              <div className="row" style={{marginTop:12}}>
                <button className="btn btn-primary" onClick={updateUser}>Save</button>
              </div>
            )}
          </div>
        </div>
      )}

      <Toast message={toast.m} type={toast.t} />
    </div>
  )
}
