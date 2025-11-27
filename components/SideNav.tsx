'use client'
import Link from 'next/link'

export default function SideNav() {
  return (
    <div className="side" style={{padding:16}}>
      <div style={{display:'grid',gap:8}}>
        <Link href="/" className="btn" style={{display:'block',textDecoration:'none'}}>Dashboard</Link>
        <Link href="/org/list" className="btn" style={{display:'block',textDecoration:'none'}}>Orgs</Link>
        <Link href="/members" className="btn" style={{display:'block',textDecoration:'none'}}>Members</Link>
        <Link href="/settings" className="btn" style={{display:'block',textDecoration:'none'}}>Settings</Link>
      </div>
    </div>
  )
}
