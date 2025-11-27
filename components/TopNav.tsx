'use client'
import Link from 'next/link'

export default function TopNav() {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 24px'}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{width:24,height:24,borderRadius:6,background:'var(--accent)'}}></div>
        <div style={{fontWeight:600}}>MARQ</div>
      </div>
      <div style={{display:'flex',gap:20}}>
        <Link href="/" style={{color:'var(--muted)'}}>Dashboard</Link>
        <Link href="/org/list" style={{color:'var(--muted)'}}>Orgs</Link>
        <Link href="/members" style={{color:'var(--muted)'}}>Members</Link>
        <Link href="/settings" style={{color:'var(--muted)'}}>Settings</Link>
      </div>
    </div>
  )
}
