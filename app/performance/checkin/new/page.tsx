'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'
import GlassInput from '@components/ui/GlassInput'
import { ArrowLeft } from 'lucide-react'

export default function NewCheckinPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orgId = searchParams.get('orgId')
  const memberId = searchParams.get('memberId')

  const [form, setForm] = useState({
    period_start: '',
    period_end: '',
    summary: '',
    self_score: ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!orgId || !memberId || !form.period_start || !form.period_end) return
    setLoading(true)
    try {
      const payload: any = {
        org_id: orgId,
        member_id: memberId,
        period_start: form.period_start,
        period_end: form.period_end,
        summary: form.summary
      }
      if (form.self_score) payload.self_score = Number(form.self_score)

      const res = await fetch('/api/performance/checkin/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': memberId || '',
          'x-role': 'member'
        },
        body: JSON.stringify(payload)
      })
      
      if (res.ok) {
        router.push('/performance/my')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell title="New Check-in">
       <div className="max-w-2xl mx-auto">
         <GlassButton variant="ghost" onClick={() => router.back()} className="mb-4 flex items-center gap-2 text-muted-foreground">
           <ArrowLeft size={16} /> Back
         </GlassButton>
         
         <GlassCard className="p-8">
           <h1 className="text-2xl font-bold mb-6">Create Check-in</h1>
           
           <div className="space-y-6">
             <div className="grid grid-cols-2 gap-6">
               <div>
                 <label className="block text-sm font-medium mb-2 text-gray-700">Period Start</label>
                 <GlassInput 
                   type="date" 
                   className="w-full" 
                   value={form.period_start} 
                   onChange={(e: any) => setForm({...form, period_start: e.target.value})} 
                 />
               </div>
               <div>
                 <label className="block text-sm font-medium mb-2 text-gray-700">Period End</label>
                 <GlassInput 
                   type="date" 
                   className="w-full" 
                   value={form.period_end} 
                   onChange={(e: any) => setForm({...form, period_end: e.target.value})} 
                 />
               </div>
             </div>

             <div>
               <label className="block text-sm font-medium mb-2 text-gray-700">Self Assessment Score (1-5)</label>
               <GlassInput 
                 type="number" 
                 min="1" 
                 max="5" 
                 className="w-full" 
                 placeholder="Optional"
                 value={form.self_score}
                 onChange={(e: any) => setForm({...form, self_score: e.target.value})}
               />
             </div>

             <div>
               <label className="block text-sm font-medium mb-2 text-gray-700">Summary / Achievements</label>
               <textarea 
                 className="w-full min-h-[150px] p-3 rounded-xl border border-gray-200 bg-white/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                 placeholder="What did you accomplish this period?"
                 value={form.summary}
                 onChange={e => setForm({...form, summary: e.target.value})}
               />
             </div>

             <div className="pt-4 flex justify-end gap-3">
               <GlassButton variant="secondary" onClick={() => router.back()}>Cancel</GlassButton>
               <GlassButton onClick={handleSubmit} disabled={loading} className="min-w-[120px]">
                 {loading ? 'Saving...' : 'Submit Check-in'}
               </GlassButton>
             </div>
           </div>
         </GlassCard>
       </div>
    </AppShell>
  )
}
