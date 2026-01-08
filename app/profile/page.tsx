'use client'
import { useEffect, useState } from 'react'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'

type User = {
  id: string
  firstName: string
  lastName: string
  email: string
  profileImage?: string
  roleId?: string
  departmentId?: string
  status: string
  createdAt: number
}

function getCookie(name: string) {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))
  return m ? decodeURIComponent(m.split('=').slice(1).join('=')) : ''
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setUploading(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = String(reader.result || '')
      const oldImage = user.profileImage
      
      // Optimistic update
      setUser({ ...user, profileImage: base64 })

      try {
        const res = await fetch(`/api/user/${user.id}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileImage: base64 })
        })
        if (!res.ok) {
            setUser({ ...user, profileImage: oldImage })
            alert('Failed to update profile image')
        }
      } catch (e) {
        setUser({ ...user, profileImage: oldImage })
        console.error(e)
        alert('Failed to update profile image')
      } finally {
        setUploading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userId = getCookie('current_user_id')
        if (!userId) {
            setLoading(false)
            return
        }
        const res = await fetch(`/api/user/${userId}`)
        const data = await res.json()
        if (data.user) {
          setUser(data.user)
        }
      } catch (e) {
        console.error('Failed to load user', e)
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [])

  return (
    <AppShell title="My Profile">
      <GlassCard title="Profile Details">
        {loading ? (
           <div>Loading...</div>
        ) : user ? (
          <div className="grid grid-2" style={{ gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
               <div style={{ position: 'relative', width: 120, height: 120, borderRadius: 24, background: '#111', border: '1px solid var(--border)', overflow: 'hidden' }}>
                 {user.profileImage ? (
                   <img src={user.profileImage} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                 ) : (
                   <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, color: 'var(--text-secondary)' }}>
                     {user.firstName?.[0]}{user.lastName?.[0]}
                   </div>
                 )}
                 <label 
                    htmlFor="profile-upload"
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: 'rgba(0,0,0,0.6)',
                        color: 'white',
                        fontSize: 12,
                        padding: '4px 0',
                        textAlign: 'center',
                        cursor: 'pointer',
                        opacity: uploading ? 0.5 : 1
                    }}
                 >
                    {uploading ? '...' : 'Change'}
                 </label>
                 <input 
                    id="profile-upload"
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                    disabled={uploading}
                 />
               </div>
            </div>
            
            <div className="grid" style={{ gap: 16 }}>
              <div>
                <div className="label">Full Name</div>
                <div className="text-lg font-medium">{user.firstName} {user.lastName}</div>
              </div>
              
              <div>
                <div className="label">Email Address</div>
                <div className="text-lg">{user.email}</div>
              </div>

              <div>
                <div className="label">Status</div>
                <span className="badge">{user.status}</span>
              </div>
            </div>
          </div>
        ) : (
            <div>User not found</div>
        )}
      </GlassCard>
    </AppShell>
  )
}
