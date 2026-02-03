'use client'
import { useRouter } from 'next/navigation'
import GlassTable from '../ui/GlassTable'

type LogItem = {
  id: string
  created_at: string
  module: string
  field_name: string
  old_value: any
  new_value: any
  reason: string
  attachment_path?: string
  actor: { firstName: string, lastName: string, email: string }
  employee: { firstName: string, lastName: string, email: string }
}

export default function AdjustmentLogTable({ logs, loading }: { logs: LogItem[], loading: boolean }) {
  const router = useRouter()

  const formatValue = (val: any) => {
    if (typeof val === 'object' && val !== null) return JSON.stringify(val)
    return String(val)
  }

  const rows = logs.map(log => [
    <div key="date" className="flex flex-col">
        <span className="text-sm font-medium text-slate-700">{new Date(log.created_at).toLocaleDateString()}</span>
        <span className="text-xs text-slate-400">{new Date(log.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
    </div>,
    <div key="emp" className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 flex items-center justify-center text-xs font-bold border border-indigo-200/50 shadow-sm">
            {log.employee.firstName[0]}
        </div>
        <span className="text-sm text-slate-700 font-medium">{log.employee.firstName} {log.employee.lastName}</span>
    </div>,
    <span key="mod" className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-600 uppercase tracking-wider border border-indigo-100">
      {log.module}
    </span>,
    <span key="field" className="font-mono text-xs text-slate-500">{log.field_name}</span>,
    <div key="change" className="flex items-center gap-3 text-sm">
      <div className="flex flex-col items-end min-w-[60px]">
        <span className="text-red-600 bg-red-100/50 px-2 py-0.5 rounded text-xs font-mono border border-red-200/50 max-w-[120px] truncate" title={formatValue(log.old_value)}>
            {formatValue(log.old_value)}
        </span>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400"><path d="M4 12h16"/><path d="m14 6 6 6-6 6"/></svg>
      <div className="flex flex-col items-start min-w-[60px]">
        <span className="text-emerald-600 bg-emerald-100/50 px-2 py-0.5 rounded text-xs font-mono border border-emerald-200/50 max-w-[120px] truncate" title={formatValue(log.new_value)}>
            {formatValue(log.new_value)}
        </span>
      </div>
    </div>,
    <div key="reason" className="max-w-[200px] text-sm text-slate-600 truncate" title={log.reason}>
      {log.reason}
    </div>,
    <div key="actor" className="flex flex-col">
        <span className="text-xs font-medium text-slate-700">{log.actor.firstName} {log.actor.lastName}</span>
        <span className="text-[10px] text-slate-400">{log.actor.email}</span>
    </div>,
    <button 
        key="view" 
        onClick={() => router.push(`/my-adjustments/${log.id}`)} 
        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-all border border-transparent hover:border-blue-200"
        title="View Details"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
    </button>
  ])

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20">
        <div className="relative w-12 h-12 mb-4">
            <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <div className="text-sm font-medium text-slate-500 animate-pulse">Loading adjustment history...</div>
    </div>
  )

  if (logs.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 ring-4 ring-slate-50/50">
            <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-1">No Adjustments Found</h3>
        <p className="text-sm text-slate-500 max-w-xs mx-auto">There are no adjustment records matching your current filters.</p>
    </div>
  )

  return (
    <GlassTable 
      columns={['Date', 'Employee', 'Module', 'Field', 'Change', 'Reason', 'By', '']}
      rows={rows}
    />
  )
}
