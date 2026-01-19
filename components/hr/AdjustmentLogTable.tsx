"use client"
import { useState } from 'react'
import GlassTable from '../ui/GlassTable'
import GlassButton from '../ui/GlassButton'
import GlassModal from '../ui/GlassModal'
import { format } from 'date-fns' // Assuming date-fns is available, or use native

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
  const [selectedLog, setSelectedLog] = useState<LogItem | null>(null)

  const formatValue = (val: any) => {
    if (typeof val === 'object' && val !== null) return JSON.stringify(val)
    return String(val)
  }

  const rows = logs.map(log => [
    <span key="date" style={{fontSize:'0.9em', color:'rgba(255,255,255,0.7)'}}>
      {new Date(log.created_at).toLocaleString()}
    </span>,
    <span key="emp" style={{fontWeight:500}}>
      {log.employee.firstName} {log.employee.lastName}
    </span>,
    <span key="mod" className="tag-pill" style={{textTransform:'uppercase', fontSize:'0.7em'}}>
      {log.module}
    </span>,
    log.field_name,
    <div key="change" style={{display:'flex', alignItems:'center', gap:8, fontSize:'0.9em'}}>
      <span style={{color:'rgba(255,100,100,0.8)'}}>{formatValue(log.old_value)}</span>
      <span>→</span>
      <span style={{color:'rgba(100,255,100,0.8)'}}>{formatValue(log.new_value)}</span>
    </div>,
    <div key="reason" style={{maxWidth: 200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
      {log.reason}
    </div>,
    <span key="actor" style={{fontSize:'0.9em', color:'rgba(255,255,255,0.7)'}}>
      {log.actor.firstName} {log.actor.lastName}
    </span>,
    <GlassButton key="view" onClick={() => setSelectedLog(log)} style={{padding:'4px 8px', fontSize:12}}>
      View
    </GlassButton>
  ])

  return (
    <>
      {loading ? (
        <div style={{padding:20, textAlign:'center', color:'rgba(255,255,255,0.5)'}}>Loading logs...</div>
      ) : logs.length === 0 ? (
        <div style={{padding:20, textAlign:'center', color:'rgba(255,255,255,0.5)'}}>No adjustments found.</div>
      ) : (
        <GlassTable 
          columns={['Date', 'Employee', 'Module', 'Field', 'Change', 'Reason', 'By', '']}
          rows={rows}
        />
      )}

      {selectedLog && (
        <GlassModal open={true} title="Adjustment Details" onClose={() => setSelectedLog(null)}>
          <div style={{display:'grid', gap:16}}>
            <div className="grid grid-2" style={{gap:16}}>
              <div>
                <label className="label">Date</label>
                <div className="value">{new Date(selectedLog.created_at).toLocaleString()}</div>
              </div>
              <div>
                <label className="label">Module</label>
                <div className="value">{selectedLog.module}</div>
              </div>
              <div>
                <label className="label">Employee</label>
                <div className="value">{selectedLog.employee.firstName} {selectedLog.employee.lastName}</div>
              </div>
              <div>
                <label className="label">Changed By</label>
                <div className="value">{selectedLog.actor.firstName} {selectedLog.actor.lastName}</div>
              </div>
            </div>

            <div style={{background:'rgba(255,255,255,0.05)', padding:12, borderRadius:8}}>
              <label className="label" style={{marginBottom:8, display:'block'}}>Field: {selectedLog.field_name}</label>
              <div style={{display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:12, alignItems:'center'}}>
                <div>
                  <div className="label">Old Value</div>
                  <pre style={{margin:0, whiteSpace:'pre-wrap', color:'rgba(255,100,100,0.9)'}}>
                    {JSON.stringify(selectedLog.old_value, null, 2)}
                  </pre>
                </div>
                <div style={{fontSize:24, color:'rgba(255,255,255,0.3)'}}>→</div>
                <div>
                  <div className="label">New Value</div>
                  <pre style={{margin:0, whiteSpace:'pre-wrap', color:'rgba(100,255,100,0.9)'}}>
                    {JSON.stringify(selectedLog.new_value, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div>
              <label className="label">Reason</label>
              <div className="value" style={{background:'rgba(255,255,255,0.05)', padding:12, borderRadius:8}}>
                {selectedLog.reason}
              </div>
            </div>

            {selectedLog.attachment_path && (
              <div>
                <label className="label">Attachment</label>
                {/* 
                   We don't have a direct download URL logic yet because of RLS.
                   Usually we'd generate a signed URL.
                   For now, we just show the path or a placeholder link.
                   If Supabase storage is public (it isn't), we could link directly.
                   We'll assume there is a way to view it or just show the path.
                   Ideally, we would create an API to sign the URL.
                */}
                <div className="value">
                   <a href="#" style={{color:'var(--primary)'}} onClick={(e) => {
                     e.preventDefault()
                     alert('Attachment download not implemented yet (requires signed URL generation). Path: ' + selectedLog.attachment_path)
                   }}>
                     View Attachment
                   </a>
                </div>
              </div>
            )}
          </div>
        </GlassModal>
      )}
    </>
  )
}
