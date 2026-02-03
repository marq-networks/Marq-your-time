'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  ArrowLeft, 
  User as UserIcon, 
  Building2, 
  Clock, 
  FileText, 
  MessageSquare,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { motion } from 'framer-motion'

import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassSelect from '@components/ui/GlassSelect'
import GlassInput from '@components/ui/GlassInput'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string }

const TICKET_CATEGORIES = [
  { value: 'hr', label: 'HR Support', icon: UserIcon },
  { value: 'it', label: 'IT Support', icon: Clock },
  { value: 'payroll', label: 'Payroll', icon: FileText },
  { value: 'other', label: 'General Inquiry', icon: MessageSquare },
]

const PRIORITY_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'high', label: 'High', color: 'bg-red-50 text-red-700 border-red-200' },
]

function CreateTicketContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [orgs, setOrgs] = useState<Org[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [orgId, setOrgId] = useState(searchParams.get('orgId') || '')
  const [userId, setUserId] = useState(searchParams.get('userId') || '')
  
  const [form, setForm] = useState({ 
    category: 'hr', 
    title: '', 
    description: '', 
    priority: 'normal' 
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Data Loading
  const loadOrgs = async () => { 
    const res = await fetch('/api/org/list', { cache: 'no-store' })
    const d = await res.json()
    setOrgs(d.items || [])
    if (!orgId && d.items?.length) setOrgId(d.items[0].id) 
  }

  const loadUsers = async (oid: string) => { 
    const res = await fetch(`/api/user/list?orgId=${oid}`, { cache: 'no-store' })
    const d = await res.json()
    setUsers(d.items || [])
    // Only set default userId if not already set from URL
    if (!userId && d.items?.length) setUserId(d.items[0].id) 
  }

  useEffect(() => { loadOrgs() }, [])
  useEffect(() => { if (orgId) loadUsers(orgId) }, [orgId])

  const handleSubmit = async () => {
    if (!orgId || !userId || !form.category || !form.title) {
      alert('Please fill in all required fields')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/support/tickets/create', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId }, 
        body: JSON.stringify({ 
          org_id: orgId, 
          category: form.category, 
          title: form.title, 
          description: form.description, 
          priority: form.priority 
        }) 
      })

      if (res.ok) {
        router.push('/support')
        router.refresh()
      } else {
        alert('Failed to create ticket')
      }
    } catch (e) {
      console.error(e)
      alert('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <GlassButton onClick={() => router.back()} className="px-3">
          <ArrowLeft size={20} />
        </GlassButton>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Ticket</h1>
          <p className="text-sm text-gray-500">Submit a support request to the team</p>
        </div>
      </div>

      {/* Context Selection */}
      <GlassCard className="mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <UserIcon size={16} className="text-indigo-600" /> 
          Requester Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1.5 ml-1">
              <Building2 size={14} /> Organization
            </label>
            <GlassSelect value={orgId} onChange={(e: any) => setOrgId(e.target.value)}>
              <option value="">Select Organization</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1.5 ml-1">
              <UserIcon size={14} /> User
            </label>
            <GlassSelect value={userId} onChange={(e: any) => setUserId(e.target.value)}>
              <option value="">Select User</option>
              {users.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
            </GlassSelect>
          </div>
        </div>
      </GlassCard>

      {/* Ticket Form */}
      <GlassCard>
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText size={16} className="text-indigo-600" /> 
          Ticket Details
        </h3>
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block ml-1">Category</label>
              <GlassSelect value={form.category} onChange={(e: any) => setForm({ ...form, category: e.target.value })}>
                {TICKET_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </GlassSelect>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block ml-1">Priority</label>
              <GlassSelect value={form.priority} onChange={(e: any) => setForm({ ...form, priority: e.target.value })}>
                {PRIORITY_LEVELS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </GlassSelect>
            </div>
          </div>
          
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block ml-1">Subject</label>
            <GlassInput 
              value={form.title} 
              onChange={(e: any) => setForm({ ...form, title: e.target.value })}
              placeholder="Brief summary of the issue..."
              className="w-full"
            />
          </div>
          
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block ml-1">Description</label>
            <textarea 
              className="w-full rounded-xl border-gray-200 bg-white/50 focus:border-indigo-500 focus:ring-indigo-500 p-3 text-sm min-h-[150px]"
              placeholder="Detailed explanation of your request..."
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })} 
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <GlassButton onClick={() => router.back()} className="bg-white hover:bg-gray-50 text-gray-700">
              Cancel
            </GlassButton>
            <GlassButton 
              onClick={handleSubmit} 
              className="bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Submit Ticket'}
            </GlassButton>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}

export default function CreateTicketPage() {
  return (
    <AppShell title="Create Ticket">
      <Suspense fallback={<div className="p-10 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>}>
        <CreateTicketContent />
      </Suspense>
    </AppShell>
  )
}
