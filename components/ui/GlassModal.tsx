'use client'

export default function GlassModal({ open, title, children, onClose }: { open: boolean, title: string, children: React.ReactNode, onClose: () => void }) {
  if (!open) return null
  return (
    <div className="modal-overlay">
      <div className="glass-panel strong" style={{width:560,padding:20,borderRadius:'var(--radius-large)'}}>
        <div className="card-title" style={{marginBottom:12}}>{title}</div>
        {children}
        <div style={{display:'flex',justifyContent:'flex-end',marginTop:12}}>
          <button className="btn-glass" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

