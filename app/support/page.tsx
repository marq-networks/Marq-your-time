'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  Search, 
  FileText, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  MoreHorizontal,
  Download,
  Filter,
  User as UserIcon,
  Building2,
  Send
} from 'lucide-react'

import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassModal from '@components/ui/GlassModal'
import GlassSelect from '@components/ui/GlassSelect'
import GlassInput from '@components/ui/GlassInput'
import ExportMenu from '@components/shared/ExportMenu'
import TagPill from '@components/ui/TagPill'
import { ExportColumn, exportToCsv, exportToPdf } from '@lib/export-utils'

type Org = { id: string, orgName: string }
type User = { id: string, firstName: string, lastName: string }
type Ticket = { 
  id: string, 
  orgId: string, 
  createdByUserId: string, 
  category: string, 
  title: string, 
  description?: string, 
  status: string, 
  priority: string, 
  assignedToUserId?: string, 
  createdAt: number, 
  updatedAt: number 
}
type Comment = { id: string, ticketId: string, userId: string, body: string, createdAt: number }

const TICKET_CATEGORIES = [
  { value: 'hr', label: 'HR Support', icon: UserIcon },
  { value: 'it', label: 'IT Support', icon: Clock }, // Using Clock as placeholder or specialized icon
  { value: 'payroll', label: 'Payroll', icon: FileText },
  { value: 'other', label: 'General Inquiry', icon: MessageSquare },
]

const PRIORITY_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'high', label: 'High', color: 'bg-red-50 text-red-700 border-red-200' },
]

const STATUS_CONFIG: Record<string, { label: string, color: string, icon: any }> = {
  'open': { label: 'Open', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: AlertCircle },
  'in_progress': { label: 'In Progress', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Clock },
  'resolved': { label: 'Resolved', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: CheckCircle2 },
  'closed': { label: 'Closed', color: 'bg-gray-100 text-gray-600 border-gray-200', icon: CheckCircle2 },
}

export default function SupportPage() {
  const router = useRouter()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [orgId, setOrgId] = useState('')
  const [userId, setUserId] = useState('')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  // Modal States
  const [openDetail, setOpenDetail] = useState(false)
  
  // Forms
  const [detail, setDetail] = useState<{ ticket: Ticket, comments: Comment[] } | null>(null)
  const [newComment, setNewComment] = useState('')
  const [isExporting, setIsExporting] = useState(false)

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
    if (!userId && d.items?.length) setUserId(d.items[0].id) 
  }

  const loadMy = async (uid: string) => { 
    setIsLoading(true)
    try {
      const res = await fetch(`/api/support/tickets/my?user_id=${uid}`, { cache: 'no-store' })
      const d = await res.json()
      setTickets(d.items || [])
    } finally {
      setIsLoading(false)
    }
  }

  const openTicket = async (id: string) => { 
    const res = await fetch(`/api/support/tickets/detail?id=${id}`, { cache: 'no-store' })
    const d = await res.json()
    setDetail(d)
    setOpenDetail(true) 
  }

  const submitComment = async () => {
    if (!detail || !newComment.trim()) return
    const res = await fetch('/api/support/tickets/comment', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId }, 
      body: JSON.stringify({ ticket_id: detail.ticket.id, body: newComment }) 
    })
    if (res.ok) { 
      setNewComment('')
      await openTicket(detail.ticket.id) 
    }
  }

  const handleExport = async (type: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      if (tickets.length === 0) {
        alert('No data to export')
        return
      }
      const exportColumns: ExportColumn[] = [
        { header: 'Title', accessor: 'title' },
        { header: 'Category', accessor: 'category' },
        { header: 'Status', accessor: 'status' },
        { header: 'Priority', accessor: 'priority' },
        { header: 'Created', accessor: (item) => new Date(item.createdAt).toLocaleString() }
      ]
      const filename = `support_tickets_${new Date().toISOString().split('T')[0]}`
      if (type === 'csv') {
        await exportToCsv(tickets, exportColumns, filename)
      } else {
        await exportToPdf(tickets, exportColumns, 'Support Tickets', filename)
      }
    } catch (e) {
      console.error(e)
      alert('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  useEffect(() => { loadOrgs() }, [])
  useEffect(() => { if (orgId) loadUsers(orgId) }, [orgId])
  useEffect(() => { if (userId) loadMy(userId) }, [userId])

  return (
    <AppShell title="Support Center">
      <div className="space-y-6 max-w-7xl mx-auto p-4">
        
        {/* Context Selector Bar */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row gap-4 p-4 rounded-2xl bg-white/40 backdrop-blur-md border border-white/50 shadow-sm items-center"
        >
          <div className="flex-1 w-full md:w-auto">
            <label className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1.5 ml-1">
              <Building2 size={14} /> Organization
            </label>
            <GlassSelect value={orgId} onChange={(e: any) => setOrgId(e.target.value)}>
              <option value="">Select Organization</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.orgName}</option>)}
            </GlassSelect>
          </div>
          <div className="flex-1 w-full md:w-auto">
            <label className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1.5 ml-1">
              <UserIcon size={14} /> User Context
            </label>
            <GlassSelect value={userId} onChange={(e: any) => setUserId(e.target.value)}>
              <option value="">Select User</option>
              {users.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
            </GlassSelect>
          </div>
        </motion.div>

        {/* Action Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">My Tickets</h2>
            <p className="text-sm text-gray-500 mt-1">Track and manage your support requests</p>
          </div>
          <div className="flex items-center gap-3">
            <ExportMenu onExport={handleExport} isExporting={isExporting} />
            <GlassButton 
              onClick={() => router.push(`/support/create?orgId=${orgId}&userId=${userId}`)} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200"
            >
              <Plus size={16} className="mr-2" /> New Ticket
            </GlassButton>
          </div>
        </div>

        {/* Tickets List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : tickets.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white/30 rounded-3xl border border-white/50 border-dashed"
            >
              <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                <MessageSquare size={32} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No tickets yet</h3>
              <p className="text-gray-500 max-w-xs mb-6">You haven't created any support tickets. Need help? Create a new ticket to get started.</p>
              <GlassButton onClick={() => router.push(`/support/create?orgId=${orgId}&userId=${userId}`)}>
                Create Ticket
              </GlassButton>
            </motion.div>
          ) : (
            <div className="grid gap-4">
              {tickets.map((t, idx) => {
                const StatusIcon = STATUS_CONFIG[t.status]?.icon || AlertCircle
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => openTicket(t.id)}
                    className="group relative bg-white/60 hover:bg-white/90 backdrop-blur-sm p-5 rounded-2xl border border-white/60 shadow-sm hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl ${STATUS_CONFIG[t.status]?.color || 'bg-gray-100 text-gray-600'}`}>
                          <StatusIcon size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                              {t.title}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200 uppercase tracking-wider">
                              {t.category}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {new Date(t.createdAt).toLocaleDateString()} • {new Date(t.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                            {t.priority !== 'normal' && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase border ${
                                PRIORITY_LEVELS.find(p => p.value === t.priority)?.color
                              }`}>
                                {t.priority} Priority
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3 pl-14 sm:pl-0">
                         <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 ${STATUS_CONFIG[t.status]?.color}`}>
                            {STATUS_CONFIG[t.status]?.label}
                         </div>
                         <div className="text-gray-300 group-hover:text-indigo-400 transition-colors">
                            <MoreHorizontal size={20} />
                         </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Ticket Detail Modal */}
      <GlassModal open={openDetail} title={detail?.ticket.title || 'Ticket Details'} onClose={() => setOpenDetail(false)}>
        {detail && (
          <div className="flex flex-col h-[70vh]">
            {/* Header Info */}
            <div className="flex-shrink-0 mb-4 pb-4 border-b border-gray-100">
              <div className="flex flex-wrap gap-2 mb-3">
                <span className={`px-2 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 ${STATUS_CONFIG[detail.ticket.status]?.color}`}>
                   {STATUS_CONFIG[detail.ticket.status]?.label}
                </span>
                <span className="px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                   {detail.ticket.category}
                </span>
                <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${PRIORITY_LEVELS.find(p => p.value === detail.ticket.priority)?.color}`}>
                   {detail.ticket.priority} Priority
                </span>
              </div>
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                {detail.ticket.description || 'No description provided.'}
              </p>
            </div>

            {/* Comments Area */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-2 space-y-4 mb-4 scrollbar-thin scrollbar-thumb-gray-200">
              {detail.comments && detail.comments.length > 0 ? (
                detail.comments.map(c => (
                  <div key={c.id} className={`flex flex-col ${c.userId === userId ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${
                      c.userId === userId 
                        ? 'bg-indigo-50 text-indigo-900 rounded-tr-sm border border-indigo-100' 
                        : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'
                    }`}>
                      <p>{c.body}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1 px-1">
                      {new Date(c.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                   <MessageSquare size={24} className="mb-2 opacity-20" />
                   <span className="text-xs">No comments yet</span>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="flex-shrink-0 pt-2">
              <div className="flex gap-2 items-center bg-white p-2 rounded-2xl border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                <input 
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-2"
                  placeholder="Type a message..." 
                  value={newComment} 
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitComment()}
                />
                <button 
                  onClick={submitComment}
                  disabled={!newComment.trim()}
                  className="p-2 rounded-xl bg-indigo-600 text-white disabled:opacity-50 disabled:bg-gray-300 transition-all hover:bg-indigo-700"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </GlassModal>
    </AppShell>
  )
}


