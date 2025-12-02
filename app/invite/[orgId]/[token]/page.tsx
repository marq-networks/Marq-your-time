'use client'
import { useEffect, useState } from 'react'
import Card from '@components/Card'
import Toast from '@components/Toast'

export default function InvitePage({ params }: { params: { orgId: string, token: string } }) {
  const [toast, setToast] = useState<{m?:string,t?:'success'|'error'}>({})
  const [invitedEmail, setInvitedEmail] = useState('')
  const [roles, setRoles] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [form, setForm] = useState<any>({
    profileImage: '',
    firstName: '',
    lastName: '',
    email: '',
    roleId: '',
    departmentId: '',
    status: 'active'
  })

  const load = async () => {
    const [orgRes, rRes, dRes] = await Promise.all([
      fetch(`/api/org/${params.orgId}`, { cache:'no-store' }),
      fetch(`/api/role/list?orgId=${params.orgId}`, { cache:'no-store' }),
      fetch(`/api/department/list?orgId=${params.orgId}`, { cache:'no-store' })
    ])
    const [orgData, r, d] = await Promise.all([orgRes.json(), rRes.json(), dRes.json()])
    const invite = (orgData.invites||[]).find((i:any)=> i.token === params.token)
    const email = invite?.invitedEmail || ''
    setInvitedEmail(email)
    setForm((f:any)=> ({ ...f, email }))
    setRoles(r.items || [])
    setDepartments(d.items || [])
  }
  useEffect(()=>{ load() }, [])

  const createAccount = async () => {
    const acceptRes = await fetch(`/api/invite/${params.token}/accept`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ grantPermissions: true }) })
    const acc = await acceptRes.json()
    if (!acceptRes.ok) { setToast({ m: acc.error || 'Error', t:'error' }); return }
    const body = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      orgId: params.orgId,
      roleId: form.roleId,
      departmentId: form.departmentId,
      positionTitle: '',
      profileImage: form.profileImage || undefined,
      salary: 0,
      workingDays: ['Mon','Tue','Wed','Thu','Fri'],
      workingHoursPerDay: 8,
      status: form.status
    }
    const res = await fetch('/api/user/create', { method:'POST', headers:{ 'Content-Type':'application/json','x-user-id':'admin' }, body: JSON.stringify(body) })
    const d = await res.json()
    if (res.ok) setToast({ m:'Account created', t:'success' })
    else setToast({ m: d.error || 'Error', t:'error' })
  }

  return (
    <div className="grid">
      <Card title="Organization Invite">
        <div className="subtitle" style={{marginBottom:12}}>Org ID: {params.orgId}</div>
        <div className="grid">
          <div>
            <div className="label">Photo URL</div>
            <input className="input" value={form.profileImage} onChange={e=>setForm({...form, profileImage: e.target.value})} />
          </div>
          <div className="grid grid-2">
            <div>
              <div className="label">First Name</div>
              <input className="input" value={form.firstName} onChange={e=>setForm({...form, firstName: e.target.value})} />
            </div>
            <div>
              <div className="label">Last Name</div>
              <input className="input" value={form.lastName} onChange={e=>setForm({...form, lastName: e.target.value})} />
            </div>
          </div>
          <div>
            <div className="label">Email</div>
            <input className="input" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} placeholder={invitedEmail||''} />
          </div>
          <div className="grid grid-3">
            <div>
              <div className="label">Role</div>
              <select className="input" value={form.roleId} onChange={e=>setForm({...form, roleId: e.target.value})}>
                <option value="">Select role</option>
                {roles.map((r:any)=> <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <div className="label">Department</div>
              <select className="input" value={form.departmentId} onChange={e=>setForm({...form, departmentId: e.target.value})}>
                <option value="">Select department</option>
                {departments.map((d:any)=> <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <div className="label">Status</div>
              <select className="input" value={form.status} onChange={e=>setForm({...form, status: e.target.value})}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="suspended">suspended</option>
              </select>
            </div>
          </div>
          <div className="row" style={{justifyContent:'flex-end', gap:12}}>
            <button className="btn" onClick={async()=>{ const res = await fetch(`/api/invite/${params.token}/reject`, { method:'POST' }); const d = await res.json(); if(res.ok) setToast({ m:'Invite revoked', t:'success' }); else setToast({ m:d.error||'Error', t:'error' }) }}>Reject</button>
            <button className="btn btn-primary" onClick={createAccount}>Create Account</button>
          </div>
        </div>
      </Card>
      <Toast message={toast.m} type={toast.t} />
    </div>
  )
}
