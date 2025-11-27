export default function Card({ title, children, right }: { title?: string, children: React.ReactNode, right?: React.ReactNode }) {
  return (
    <div className="card">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        {title ? <div className="title">{title}</div> : <div />}
        {right}
      </div>
      {children}
    </div>
  )
}
