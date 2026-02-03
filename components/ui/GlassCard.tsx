export default function GlassCard({ title, children, right, className }: { title?: React.ReactNode, children: React.ReactNode, right?: React.ReactNode, className?: string }) {
  return (
    <div className={`card ${className || ''}`}>
      {(title || right) && (
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          {title ? <div className="card-title">{title}</div> : <div />}
          {right}
        </div>
      )}
      {children}
    </div>
  )
}
