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

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.src = URL.createObjectURL(file)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_SIZE = 500
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width
            width = MAX_SIZE
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height
            height = MAX_SIZE
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
            ctx.drawImage(img, 0, 0, width, height)
            const base64 = canvas.toDataURL('image/jpeg', 0.7)
            resolve(base64)
        } else {
            reject(new Error('Canvas context not available'))
        }
      }
      img.onerror = reject
    })
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setUploading(true)
    const oldImage = user.profileImage
    
    try {
        const base64 = await resizeImage(file)
      
        // Optimistic update
        setUser({ ...user, profileImage: base64 })

        const res = await fetch(`/api/user/${user.id}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileImage: base64 })
        })
        if (!res.ok) {
            const errText = await res.text()
            console.error('Update failed:', res.status, errText)
            let errMsg = res.statusText
            try {
                const json = JSON.parse(errText)
                if (json.error) errMsg = json.error
                if (json.message) errMsg += `: ${json.message}`
            } catch {}
            setUser({ ...user, profileImage: oldImage })
            alert(`Failed to update profile image: ${errMsg}`)
        }
    } catch (e) {
        console.error(e)
        setUser({ ...user, profileImage: oldImage })
        alert('Failed to update profile image')
    } finally {
        setUploading(false)
    }
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
