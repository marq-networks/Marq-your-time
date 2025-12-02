'use client'

export default function TopBar({ title }: { title: string }) {
  return (
    <div className="topbar glass-panel" style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',borderRadius:'var(--radius-large)'}}>
      <div className="page-title">{title}</div>
      <div className="user-pill">
        <div className="avatar" />
        <div className="user-name">User Name</div>
      </div>
    </div>
  )
}

