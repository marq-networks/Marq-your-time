'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Mail, Briefcase, Shield, Calendar, User as UserIcon, Building2, MapPin, Activity, Edit2, Ban, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassModal from '@components/ui/GlassModal'
import Toast from '@components/Toast'
import usePermission from '@lib/hooks/usePermission'

type User = { 
  id: string
  firstName: string
  lastName: string
  email: string
  profileImage?: string
  roleId?: string
  departmentId?: string
  status: string
  createdAt?: string
  salary?: number
  workingHoursPerDay?: number
  workingDays?: string[]
}

type Role = { id: string, name: string }
type Department = { id: string, name: string }

export default function UserDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<Role[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [toast, setToast] = useState<{m?:string,t?:'success'|'error'}>({})
  
  // Edit State
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<User | null>(null)
  
  const canManageUsers = usePermission('manage_users').allowed

  // Load Meta Data (Roles & Departments)
  const loadMeta = async () => {
    try {
      // We need orgId to fetch roles/depts. 
      // Ideally we get it from the user, but we might not have it yet.
      // For now, let's try to fetch current org from cookie or just fetch all if possible?
      // The API requires orgId usually.
      // Let's assume we can get it from the user object once loaded, or use the current session's org.
      const cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
      if (cookieOrgId) {
        const [rRes, dRes] = await Promise.all([
          fetch(`/api/role/list?orgId=${cookieOrgId}`),
          fetch(`/api/department/list?orgId=${cookieOrgId}`)
        ])
        const [r, d] = await Promise.all([rRes.json(), dRes.json()])
        setRoles(r.items || [])
        setDepartments(d.items || [])
      }
    } catch (e) {
      console.error('Failed to load meta', e)
    }
  }

  const loadUser = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/user/${params.id}`)
      if (!res.ok) throw new Error('User not found')
      const data = await res.json()
      setUser(data.user)
      setEditForm(data.user)
    } catch (e) {
      console.error(e)
      setToast({ m: 'Failed to load user', t: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUser()
    loadMeta()
  }, [params.id])

  const roleName = (id?: string) => roles.find(r=>r.id===id)?.name || id || '-'
  const deptName = (id?: string) => departments.find(d=>d.id===id)?.name || id || '-'

  const handleUpdate = async () => {
    if (!editForm || !user) return
    
    try {
        const payload = {
            departmentId: editForm.departmentId,
            roleId: editForm.roleId,
            status: editForm.status,
            salary: editForm.salary,
            workingDays: editForm.workingDays,
            workingHoursPerDay: editForm.workingHoursPerDay
        }

        const res = await fetch(`/api/user/${user.id}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        
        const data = await res.json()
        if (res.ok) {
            setToast({ m: 'User updated successfully', t: 'success' })
            setUser({ ...user, ...editForm })
            setEditOpen(false)
        } else {
            setToast({ m: data.error || 'Update failed', t: 'error' })
        }
    } catch (e) {
        setToast({ m: 'Update failed', t: 'error' })
    }
  }

  const toggleStatus = async () => {
    if (!user) return
    const action = user.status === 'suspended' ? 'activate' : 'suspend'
    try {
        const res = await fetch(`/api/user/${user.id}/${action}`, { method: 'POST' })
        if (res.ok) {
            setToast({ m: `User ${action}d successfully`, t: 'success' })
            loadUser()
        } else {
            setToast({ m: 'Action failed', t: 'error' })
        }
    } catch (e) {
        setToast({ m: 'Action failed', t: 'error' })
    }
  }

  if (loading) {
    return (
      <AppShell title="User Details">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      </AppShell>
    )
  }

  if (!user) {
    return (
      <AppShell title="User Details">
        <div className="text-center p-12">
            <h2 className="text-xl font-semibold text-gray-700">User not found</h2>
            <Link href="/users" className="text-emerald-500 hover:underline mt-4 inline-block">Back to Users</Link>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="User Details">
      <div className="space-y-6 max-w-5xl mx-auto">
        
        {/* Header / Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Link href="/users" className="hover:text-emerald-600 flex items-center gap-1 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Users
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-gray-900 font-medium">Profile</span>
        </div>

        {/* Profile Card */}
        <div className="relative overflow-hidden bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl p-8 shadow-sm">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>

            <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
                {/* Avatar */}
                <div className="flex-shrink-0">
                    <div className="w-32 h-32 rounded-3xl bg-white shadow-xl shadow-emerald-500/10 p-1 flex items-center justify-center overflow-hidden border border-white/50">
                        {user.profileImage ? (
                            <img src={user.profileImage} alt="" className="w-full h-full object-cover rounded-2xl" />
                        ) : (
                            <div className="w-full h-full bg-gray-50 rounded-2xl flex items-center justify-center text-4xl font-bold text-gray-300">
                                {user.firstName[0]}
                            </div>
                        )}
                    </div>
                </div>

                {/* Info */}
                <div className="flex-1 space-y-4">
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">{user.firstName} {user.lastName}</h1>
                            <div className="flex items-center gap-2 text-gray-500 mt-1">
                                <Mail className="w-4 h-4" /> {user.email}
                            </div>
                        </div>
                        <div className={`px-4 py-1.5 rounded-full text-sm font-medium border ${
                            user.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            user.status === 'suspended' ? 'bg-red-50 text-red-700 border-red-100' :
                            'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                            <span className="capitalize">{user.status}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                        <div className="bg-white/50 rounded-xl p-4 border border-white/60">
                            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                                <Shield className="w-4 h-4" /> Role
                            </div>
                            <div className="font-semibold text-gray-800">{roleName(user.roleId)}</div>
                        </div>
                        <div className="bg-white/50 rounded-xl p-4 border border-white/60">
                            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                                <Briefcase className="w-4 h-4" /> Department
                            </div>
                            <div className="font-semibold text-gray-800">{deptName(user.departmentId)}</div>
                        </div>
                        <div className="bg-white/50 rounded-xl p-4 border border-white/60">
                            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                                <Calendar className="w-4 h-4" /> Joined
                            </div>
                            <div className="font-semibold text-gray-800">
                                {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                            </div>
                        </div>
                    </div>

                    {/* Employment Details */}
                    {canManageUsers && (
                        <div className="bg-white/40 rounded-xl p-6 border border-white/50 mt-6">
                            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Employment Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Salary / Rate</div>
                                    <div className="font-medium text-gray-900">{user.salary ? `$${user.salary.toLocaleString()}` : '-'}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Working Hours / Day</div>
                                    <div className="font-medium text-gray-900">{user.workingHoursPerDay || '-'} hrs</div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 mb-1">Working Days</div>
                                    <div className="flex gap-1 flex-wrap">
                                        {user.workingDays && user.workingDays.length > 0 ? (
                                            user.workingDays.map(d => (
                                                <span key={d} className="px-2 py-0.5 bg-white rounded text-xs text-gray-600 border border-gray-200 capitalize">{d.slice(0,3)}</span>
                                            ))
                                        ) : '-'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                        {canManageUsers && (
                            <>
                                <button 
                                    onClick={() => setEditOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20 font-medium"
                                >
                                    <Edit2 className="w-4 h-4" /> Edit Profile
                                </button>
                                <button 
                                    onClick={toggleStatus}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors font-medium ${
                                        user.status === 'suspended' 
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                            : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                                    }`}
                                >
                                    {user.status === 'suspended' ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                    {user.status === 'suspended' ? 'Activate User' : 'Suspend User'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* Additional Info / Tabs could go here */}
        
        {/* Edit Modal */}
        <GlassModal open={editOpen} onClose={() => setEditOpen(false)} title="Edit User Profile">
            {editForm && (
                <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                            <select 
                                value={editForm.roleId || ''} 
                                onChange={e => setEditForm({...editForm, roleId: e.target.value})}
                                className="w-full p-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white"
                            >
                                <option value="">Select Role</option>
                                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                            <select 
                                value={editForm.departmentId || ''} 
                                onChange={e => setEditForm({...editForm, departmentId: e.target.value})}
                                className="w-full p-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white"
                            >
                                <option value="">Select Department</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Salary / Rate</label>
                            <input 
                                type="number"
                                value={editForm.salary || ''} 
                                onChange={e => setEditForm({...editForm, salary: Number(e.target.value)})}
                                className="w-full p-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white"
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Hours / Day</label>
                            <input 
                                type="number"
                                value={editForm.workingHoursPerDay || ''} 
                                onChange={e => setEditForm({...editForm, workingHoursPerDay: Number(e.target.value)})}
                                className="w-full p-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500/20 outline-none bg-white"
                                placeholder="8"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Working Days</label>
                        <div className="flex flex-wrap gap-2">
                            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                                const isSelected = editForm.workingDays?.includes(day)
                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => {
                                            const current = editForm.workingDays || []
                                            const updated = isSelected 
                                                ? current.filter(d => d !== day)
                                                : [...current, day]
                                            setEditForm({...editForm, workingDays: updated})
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                            isSelected 
                                                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {day.slice(0, 3).toUpperCase()}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    
                    <div className="pt-4 flex justify-end gap-3">
                        <button onClick={() => setEditOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                        <button onClick={handleUpdate} className="px-6 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors font-medium shadow-lg shadow-emerald-500/20">Save Changes</button>
                    </div>
                </div>
            )}
        </GlassModal>

        <Toast message={toast.m} type={toast.t} />
      </div>
    </AppShell>
  )
}
