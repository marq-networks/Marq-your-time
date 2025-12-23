'use client'
import Link from 'next/link'

export default function SideNav() {
  return (
    <div className="side" style={{padding:16}}>
      <div style={{display:'grid',gap:8}}>
        <Link href="/" className="btn" style={{display:'block',textDecoration:'none'}}>Dashboard</Link>
        <Link href="/my/time" className="btn" style={{display:'block',textDecoration:'none'}}>My Day</Link>
        <Link href="/org/list" className="btn" style={{display:'block',textDecoration:'none'}}>Orgs</Link>
        <Link href="/users" className="btn" style={{display:'block',textDecoration:'none'}}>Users</Link>
        <Link href="/departments" className="btn" style={{display:'block',textDecoration:'none'}}>Departments</Link>
        <Link href="/roles" className="btn" style={{display:'block',textDecoration:'none'}}>Roles</Link>
        <Link href="/members" className="btn" style={{display:'block',textDecoration:'none'}}>Members</Link>
        <Link href="/settings" className="btn" style={{display:'block',textDecoration:'none'}}>Settings</Link>
      </div>
    </div>
  )
}
