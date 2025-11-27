'use client'
import { useEffect, useState } from 'react'

export default function Toast({ message, type, duration=2500 }: { message?: string, type?: 'success'|'error', duration?: number }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (message) {
      setVisible(true)
      const t = setTimeout(() => setVisible(false), duration)
      return () => clearTimeout(t)
    }
  }, [message, duration])
  if (!visible || !message) return null
  return (
    <div className="toast" style={{borderColor: type==='success'? 'var(--accent)': '#ff3b3b'}}>{message}</div>
  )
}
