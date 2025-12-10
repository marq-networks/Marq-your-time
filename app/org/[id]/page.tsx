'use client'
import { useEffect, useState } from 'react'
import Card from '@components/Card'
import Modal from '@components/Modal'
import Toast from '@components/Toast'
import AppShell from '@components/ui/AppShell'
import { usePathname } from 'next/navigation'

export default function OrgDetail() {
  const path = usePathname()
  const id = path.split('/').pop() || ''
  const [org, setOrg] = useState<any>()
  const [invites, setInvites] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    profileImage:'',
    firstName:'',
    lastName:'',
    email:'',
    role:'member',
    departmentId:'',
    status:'active',
    assignSeat:true
  })
  const [toast, setToast] = useState<{m?:string,t?:'success'|'error'}>({})

  const load = async () => {
    const res = await fetch(`/api/org/${id}`)
    const data = await res.json()
    setOrg(data.org)
    setInvites(data.invites || [])
    const [uRes, rRes, dRes] = await Promise.all([
      fetch(`/api/user/list?orgId=${id}`, { cache:'no-store' }),
      fetch(`/api/role/list?orgId=${id}`, { cache:'no-store' }),
      fetch(`/api/department/list?orgId=${id}`, { cache:'no-store' })
    ])
    const [u, r, d] = await Promise.all([uRes.json(), rRes.json(), dRes.json()])
    setUsers(u.items || [])
    setRoles(r.items || [])
    setDepartments(d.items || [])
  }
  useEffect(() => { load() }, [])

  const updatePrice = async (price: number) => {
    const res = await fetch(`/api/org/${id}/update`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ pricePerLogin: price }) })
    const data = await res.json()
    if (res.ok) { setToast({ m:'Updated', t:'success' }); load() } else setToast({ m:data.error || 'Error', t:'error' })
  }

  const sendInvite = async () => {
    if (!inviteForm.email.trim() || !inviteForm.profileImage) { setToast({ m:'Upload profile photo and enter email', t:'error' }); return }
    const res = await fetch(`/api/org/${id}/invite`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ invitedEmail: inviteForm.email, role: 'member', assignSeat: inviteForm.assignSeat, profileImage: inviteForm.profileImage }) })
    const data = await res.json()
    if (res.ok) { setToast({ m:'Invite sent', t:'success' }); setOpen(false); load() } else setToast({ m:data.error || 'Error', t:'error' })
  }

  if (!org) return null
  return (
    <AppShell title="Organization">
    <div className="grid">
      <div className="grid grid-3">
        <Card title="Summary" right={<button className="btn" onClick={()=>setOpen(true)}>Invite</button>}>
          <div className="row" style={{gap:16}}>
            <div style={{width:48,height:48,borderRadius:12,background:'#111',border:'1px solid var(--border)'}}></div>
            <div>
              <div className="title">{org.orgName}</div>
              <div className="subtitle">Owner {org.ownerName} • {org.subscriptionType}</div>
            </div>
          </div>
        </Card>
        <Card title="Billing">
          <div className="grid grid-2">
            <div>
              <div className="subtitle">Price/Login</div>
              <div className="title">${org.pricePerLogin}</div>
            </div>
            <div>
              <div className="subtitle">Seat Limit</div>
              <div className="title">{org.totalLicensedSeats}</div>
            </div>
          </div>
          <div className="row" style={{marginTop:12}}>
            <input className="input" type="number" defaultValue={org.pricePerLogin} onBlur={e=>updatePrice(Number(e.target.value))} />
          </div>
        </Card>
        <Card title="Seat Usage">
          <div className="title">{org.usedSeats}/{org.totalLicensedSeats}</div>
        </Card>
      </div>
      <Card title="Members">
        <div className="grid">
          <table className="glass-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{width:28,height:28,borderRadius:8,background:'#111',border:'1px solid var(--border)'}}>
                      {u.profileImage && <img src={u.profileImage} alt="" style={{width:'100%',height:'100%',borderRadius:8,objectFit:'cover'}} />}
                    </div>
                  </td>
                  <td>{u.firstName} {u.lastName}</td>
                  <td>{u.email}</td>
                  <td>{(roles.find(r=>r.id===u.roleId)?.name) || ''}</td>
                  <td>{(departments.find(d=>d.id===u.departmentId)?.name) || ''}</td>
                  <td><span className="badge">{u.status}</span></td>
                  <td>
                    {u.status==='active' ? (
                      <button className="btn" onClick={async()=>{ await fetch(`/api/user/${u.id}/suspend`, { method:'POST' }); load() }}>Suspend</button>
                    ) : (
                      <button className="btn" onClick={async()=>{ await fetch(`/api/user/${u.id}/activate`, { method:'POST' }); load() }}>Activate</button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length===0 && (
                <tr><td colSpan={7}><div className="subtitle">No members yet</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Pending Invitations">
        <div className="grid">
          {(invites||[]).filter((i:any)=>i.inviteStatus==='pending').map((i:any)=>(
            <div key={i.id} className="row" style={{justifyContent:'space-between'}}>
              <div>{i.invitedEmail}</div>
              <div className="row" style={{gap:8}}>
                <a className="btn" href={`/invite/${i.token}`}>Link</a>
                <span className="badge">expires</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Modal open={open} title="Invite User" onClose={()=>setOpen(false)}>
        <div className="grid">
          <div>
            <div className="label">Profile photo</div>
            <div className="row" style={{gap:12}}>
              <div style={{width:48,height:48,borderRadius:12,background:'#111',border:'1px solid var(--border)'}}>
                {inviteForm.profileImage && <img src={inviteForm.profileImage} alt="" style={{width:'100%',height:'100%',borderRadius:12,objectFit:'cover'}} />}
              </div>
              <input type="file" accept="image/*" onChange={(e)=>{
                const f = e.target.files?.[0]
                if (!f) return
                const reader = new FileReader()
                reader.onload = () => setInviteForm({...inviteForm, profileImage: String(reader.result || '')})
                reader.readAsDataURL(f)
              }} />
            </div>
          </div>
          <div className="grid grid-2">
            <div>
              <div className="label">First Name</div>
              <input className="input" value={inviteForm.firstName} onChange={e=>setInviteForm({...inviteForm,firstName:e.target.value})} />
            </div>
            <div>
              <div className="label">Last Name</div>
              <input className="input" value={inviteForm.lastName} onChange={e=>setInviteForm({...inviteForm,lastName:e.target.value})} />
            </div>
          </div>
          <div>
            <div className="label">Email</div>
            <input className="input" value={inviteForm.email} onChange={e=>setInviteForm({...inviteForm,email:e.target.value})} />
          </div>
          <div className="grid grid-1">
            <div>
              <div className="label">Status</div>
              <select className="input" value={inviteForm.status} onChange={e=>setInviteForm({...inviteForm,status:e.target.value})}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="suspended">suspended</option>
              </select>
            </div>
          </div>
          <div className="row" style={{gap:8}}>
            <input type="checkbox" checked={inviteForm.assignSeat} onChange={e=>setInviteForm({...inviteForm,assignSeat:e.target.checked})} />
            <div className="label">Assign Seat</div>
          </div>
          <div className="row" style={{justifyContent:'flex-end',gap:8}}>
            <button className="btn" onClick={()=>setOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={sendInvite}>Send Invite</button>
          </div>
        </div>
      </Modal>
      <Toast message={toast.m} type={toast.t} />
    </div>
    </AppShell>
  )
}
