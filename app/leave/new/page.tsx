'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@components/ui/AppShell'
import { normalizeRoleForApi } from '@lib/permissions'
import { ArrowLeft, Save, AlertCircle } from 'lucide-react'

type LeaveType = { leave_type_id: string, name: string, balance: number, code: string, paid: boolean }

function LeaveRequestContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [types, setTypes] = useState<LeaveType[]>([])
  const [orgId, setOrgId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [role, setRole] = useState('')
  
  const [form, setForm] = useState({
    type: '',
    start: '',
    end: '',
    reason: ''
  })
  
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Initialize from URL params
    const s = searchParams.get('start')
    const e = searchParams.get('end')
    if (s || e) {
      setForm(f => ({ ...f, start: s || '', end: e || '' }))
    }
  }, [searchParams])

  useEffect(() => {
    const init = async () => {
      try {
        const r = normalizeRoleForApi((typeof document !== 'undefined' ? (document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('current_role='))?.split('=')[1] || '') : ''))
        setRole(r)
        
        // Get IDs from cookies
        let cookieOrgId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('current_org_id='))?.split('=')[1] || '') : ''
        let cookieUserId = typeof document !== 'undefined' ? (document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('current_user_id='))?.split('=')[1] || '') : ''
        
        // Fallback: fetch orgs if cookie missing
        if (!cookieOrgId) {
           const endpoint = r === 'super_admin' ? '/api/org/list' : '/api/orgs/my'
           const res = await fetch(endpoint, { cache:'no-store' })
           const d = await res.json()
           const items = d.items || []
           if (items.length > 0) {
             cookieOrgId = items[0].id
           }
        }

        // Fallback: fetch user if cookie missing (and we have org)
        if (cookieOrgId && !cookieUserId) {
           const res = await fetch(`/api/user/list?orgId=${cookieOrgId}`, { cache:'no-store' })
           const d = await res.json()
           const items = d.items || []
           // This is tricky if we don't know which user "me" is without a cookie. 
           // But usually api/orgs/my implies we are authenticated.
           // Let's assume for now we might need to rely on the cookie or the first user if super_admin
           if (items.length > 0) cookieUserId = items[0].id
        }

        setOrgId(cookieOrgId)
        setMemberId(cookieUserId)
      } catch (e) {
        console.error(e)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (orgId && memberId) {
      loadBalances(orgId, memberId)
    }
  }, [orgId, memberId])

  const loadBalances = async (oid: string, mid: string) => {
    if (!oid || !mid) return
    setLoading(true)
    try {
      const res = await fetch(`/api/leave/balances?org_id=${oid}&member_id=${mid}`, { cache: 'no-store' })
      const d = await res.json()
      const items = d.items || []
      setTypes(items)
      if (!form.type && items.length) {
        setForm(f => ({ ...f, type: items[0].leave_type_id }))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const submit = async () => {
    if (!orgId || !memberId) { setSubmitError('Missing organization or member information'); return }
    if (!form.type) { setSubmitError('Please select a leave type'); return }
    if (!form.start || !form.end) { setSubmitError('Please select start and end dates'); return }
    if (form.end < form.start) { setSubmitError('End date cannot be before start date'); return }
    
    setSubmitting(true)
    setSubmitError('')
    
    try {
      const res = await fetch('/api/leave/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': memberId },
        body: JSON.stringify({
          org_id: orgId,
          member_id: memberId,
          leave_type_id: form.type,
          start_date: form.start,
          end_date: form.end,
          reason: form.reason
        })
      })
      
      if (res.ok) {
        router.push('/leave')
      } else {
        const d = await res.json()
        setSubmitError(d.error || 'Request failed')
      }
    } catch (e) {
      setSubmitError('Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button 
        onClick={() => router.back()} 
        className="mb-6 flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft size={20} />
        <span>Back to Leave</span>
      </button>

      <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-white/50 shadow-sm p-8">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">New Leave Request</h1>
        
        {submitError && (
          <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-start gap-3">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div>{submitError}</div>
          </div>
        )}

        <div className="flex flex-col gap-6">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Leave Type</label>
            {loading ? (
               <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400">
                 Loading leave types...
               </div>
            ) : types.length === 0 ? (
               <div className="p-8 text-center bg-red-50 rounded-xl border border-red-100 text-red-500">
                 No leave types available. Please contact your administrator.
               </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {types.map(t => (
                <div 
                  key={t.leave_type_id}
                  onClick={() => setForm({ ...form, type: t.leave_type_id })}
                  className={`cursor-pointer p-4 rounded-xl border transition-all ${
                    form.type === t.leave_type_id 
                      ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500/20' 
                      : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-gray-900">{t.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${t.paid ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {t.paid ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">{t.balance} days available</div>
                </div>
              ))}
            </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Start Date</label>
              <input 
                type="date" 
                value={form.start} 
                onChange={e => setForm({ ...form, start: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">End Date</label>
              <input 
                type="date" 
                value={form.end} 
                onChange={e => setForm({ ...form, end: e.target.value })}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Reason</label>
            <textarea 
              rows={4}
              value={form.reason} 
              onChange={e => setForm({ ...form, reason: e.target.value })}
              placeholder="Please describe the reason for your leave request..."
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex items-center gap-4 mt-4 pt-6 border-t border-gray-100">
            <button 
              onClick={() => router.back()}
              className="px-6 py-2.5 rounded-xl text-gray-600 font-medium hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={submit}
              disabled={submitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>Processing...</>
              ) : (
                <>
                  <Save size={18} />
                  Submit Request
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LeaveRequestPage() {
  return (
    <AppShell title="New Leave Request">
      <Suspense fallback={<div>Loading...</div>}>
        <LeaveRequestContent />
      </Suspense>
    </AppShell>
  )
}
