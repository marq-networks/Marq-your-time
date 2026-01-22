export default function GlassCard({ title, children, right, className }: { title?: React.ReactNode, children: React.ReactNode, right?: React.ReactNode, className?: string }) {
  return (
    <div className={`glass-panel ${className || ''}`} style={{padding:'20px',borderRadius:'var(--radius-large)' ,marginTop:'20px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        {title ? <div className="card-title">{title}</div> : <div />}
        {right}
      </div>
      {children}
    </div>
  )
}

