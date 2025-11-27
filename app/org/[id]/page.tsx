'use client'
import { useEffect, useState } from 'react'
import Card from '@components/Card'
import Modal from '@components/Modal'
import Toast from '@components/Toast'
import { usePathname } from 'next/navigation'

export default function OrgDetail() {
  const path = usePathname()
  const id = path.split('/').pop() || ''
  const [org, setOrg] = useState<any>()
  const [invites, setInvites] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email:'', role:'member', assignSeat:true })
  const [toast, setToast] = useState<{m?:string,t?:'success'|'error'}>({})

  const load = async () => {
    const res = await fetch(`/api/org/${id}`)
    const data = await res.json()
    setOrg(data.org)
    setInvites(data.invites || [])
  }
  useEffect(() => { load() }, [])

  const updatePrice = async (price: number) => {
    const res = await fetch(`/api/org/${id}/update`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ pricePerLogin: price }) })
    const data = await res.json()
    if (res.ok) { setToast({ m:'Updated', t:'success' }); load() } else setToast({ m:data.error || 'Error', t:'error' })
  }

  const sendInvite = async () => {
    const res = await fetch(`/api/org/${id}/invite`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ invitedEmail: inviteForm.email, role: inviteForm.role, assignSeat: inviteForm.assignSeat }) })
    const data = await res.json()
    if (res.ok) { setToast({ m:'Invite sent', t:'success' }); setOpen(false); load() } else setToast({ m:data.error || 'Error', t:'error' })
  }

  if (!org) return null
  return (
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
        <div className="subtitle">Managed externally in this module</div>
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
            <div className="label">Email</div>
            <input className="input" value={inviteForm.email} onChange={e=>setInviteForm({...inviteForm,email:e.target.value})} />
          </div>
          <div>
            <div className="label">Role</div>
            <select className="input" value={inviteForm.role} onChange={e=>setInviteForm({...inviteForm,role:e.target.value})}>
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div className="row" style={{gap:8}}>
            <input type="checkbox" checked={inviteForm.assignSeat} onChange={e=>setInviteForm({...inviteForm,assignSeat:e.target.checked})} />
            <div className="label">Assign Seat</div>
          </div>
          <div className="row" style={{justifyContent:'flex-end'}}>
            <button className="btn btn-primary" onClick={sendInvite}>Send</button>
          </div>
        </div>
      </Modal>
      <Toast message={toast.m} type={toast.t} />
    </div>
  )
}
