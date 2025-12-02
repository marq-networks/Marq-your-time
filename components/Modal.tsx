'use client'
export default function Modal({ open, title, children, onClose }: { open: boolean, title: string, children: React.ReactNode, onClose: () => void }) {
  if (!open) return null
  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div className="card" style={{width:520,background:'#c9b8a4',border:'1px solid var(--border)', padding:24 ,borderRadius:8}}>
        <div className="title" style={{marginBottom:12}}>{title}</div>
        {children}
        <div style={{display:'flex',justifyContent:'flex-end',marginTop:12}}>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
