'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@components/ui/AppShell'
import GlassCard from '@components/ui/GlassCard'
import GlassButton from '@components/ui/GlassButton'

export default function AdjustmentDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [log, setLog] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    const fetchLog = async () => {
      try {
        const r = await fetch(`/api/hr-adjustments-log/${id}`)
        if (!r.ok) throw new Error('Failed to load adjustment')
        const data = await r.json()
        setLog(data)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    fetchLog()
  }, [id])

  if (loading) return (
    <AppShell title="Adjustment Details">
        <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>
    </AppShell>
  )

  if (error || !log) return (
    <AppShell title="Adjustment Details">
        <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <p className="mb-4">{error || 'Log not found'}</p>
            <GlassButton onClick={() => router.back()}>Go Back</GlassButton>
        </div>
    </AppShell>
  )

  return (
    <AppShell title="Adjustment Details">
        {/* Header Section with Gradient & Back Button */}
        <div className="relative mb-8 rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 backdrop-blur-3xl" />
            <div className="relative p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-white/20">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => router.back()} 
                        className="group flex items-center justify-center w-10 h-10 rounded-xl bg-white/50 hover:bg-white text-slate-500 hover:text-blue-600 transition-all shadow-sm border border-white/40"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-0.5 transition-transform"><path d="m15 18-6-6 6-6"/></svg>
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Adjustment Log #{id?.toString().slice(0,8)}</h1>
                        <p className="text-sm text-slate-500">View detailed history of this modification</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 bg-white/40 rounded-full px-4 py-1.5 border border-white/30 shadow-sm">
                    <div className={`w-2 h-2 rounded-full ${
                        log.status === 'approved' ? 'bg-green-500 animate-pulse' :
                        log.status === 'rejected' ? 'bg-red-500' :
                        'bg-yellow-500 animate-pulse'
                    }`} />
                    <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                        {log.status || 'Completed'}
                    </span>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
                <GlassCard className="overflow-hidden">
                    <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100/50">
                        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Change Details</h3>
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                <span className="uppercase tracking-wider">{log.module}</span>
                                <span className="text-slate-300">•</span>
                                <span className="font-mono">{log.field_name}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-8">
                        {/* Comparison View */}
                        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Previous Value */}
                            <div className="group relative">
                                <div className="absolute -top-3 left-4 px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-wider rounded border border-red-100 z-10">
                                    Before
                                </div>
                                <div className="h-full p-5 pt-6 rounded-xl bg-gradient-to-br from-red-50/50 to-transparent border border-red-100/50 group-hover:border-red-200 transition-colors">
                                    <div className="font-mono text-sm text-slate-700 whitespace-pre-wrap break-all">
                                        {JSON.stringify(log.old_value, null, 2)}
                                    </div>
                                </div>
                            </div>

                            {/* Arrow Indicator (Desktop) */}
                            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-slate-100 shadow-sm items-center justify-center z-10 text-slate-400">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                            </div>

                            {/* New Value */}
                            <div className="group relative">
                                <div className="absolute -top-3 left-4 px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-bold uppercase tracking-wider rounded border border-green-100 z-10">
                                    After
                                </div>
                                <div className="h-full p-5 pt-6 rounded-xl bg-gradient-to-br from-green-50/50 to-transparent border border-green-100/50 group-hover:border-green-200 transition-colors">
                                    <div className="font-mono text-sm text-slate-800 font-medium whitespace-pre-wrap break-all">
                                        {JSON.stringify(log.new_value, null, 2)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Reason Section */}
                        <div className="bg-slate-50/80 rounded-xl p-5 border border-slate-100">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                Reason for Change
                            </label>
                            <p className="text-sm text-slate-700 leading-relaxed">
                                {log.reason || "No specific reason provided."}
                            </p>
                        </div>
                    </div>
                </GlassCard>
            </div>

            {/* Sidebar Meta Info */}
            <div className="space-y-6">
                <GlassCard title="Information">
                    <div className="space-y-5">
                        {/* Date */}
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 p-1.5 rounded-lg bg-slate-100 text-slate-500">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-slate-500 uppercase">Date Modified</p>
                                <p className="text-sm font-semibold text-slate-800 mt-0.5">{new Date(log.created_at).toLocaleDateString()}</p>
                                <p className="text-xs text-slate-400">{new Date(log.created_at).toLocaleTimeString()}</p>
                            </div>
                        </div>

                        <div className="h-px bg-slate-100" />

                        {/* Employee */}
                        <div className="flex items-start gap-3">
                             <div className="mt-0.5 p-1.5 rounded-lg bg-blue-50 text-blue-500">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-slate-500 uppercase">Employee</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                                        {log.employee.firstName[0]}
                                    </div>
                                    <span className="text-sm font-medium text-slate-800">{log.employee.firstName} {log.employee.lastName}</span>
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">{log.employee.email}</p>
                            </div>
                        </div>

                        <div className="h-px bg-slate-100" />

                        {/* Modified By */}
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 p-1.5 rounded-lg bg-indigo-50 text-indigo-500">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-slate-500 uppercase">Modified By</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
                                        {log.actor.firstName[0]}
                                    </div>
                                    <span className="text-sm font-medium text-slate-800">{log.actor.firstName} {log.actor.lastName}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </GlassCard>

                {log.attachment_path && (
                    <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 flex items-center gap-3 transition-colors hover:bg-blue-50">
                        <div className="p-2 bg-white rounded-lg text-blue-500 shadow-sm">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">Attachment</p>
                            <p className="text-xs text-slate-500 truncate">{log.attachment_path.split('/').pop()}</p>
                        </div>
                        <button 
                            className="px-3 py-1.5 rounded-lg bg-white text-xs font-bold text-blue-600 hover:text-blue-700 shadow-sm hover:shadow border border-blue-100 transition-all"
                            onClick={()=>alert('Download logic pending')}
                        >
                            Download
                        </button>
                    </div>
                )}
            </div>
        </div>
    </AppShell>
  )
}
