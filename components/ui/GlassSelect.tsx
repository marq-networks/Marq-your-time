// components/ui/GlassSelect.tsx
'use client'

import React from 'react'

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & { children?: React.ReactNode }

export default function GlassSelect({ className, children, ...rest }: Props) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: '100%' }}>
      <select
        {...rest}
        className={`glass-select${className ? ` ${className}` : ''}`}
      >
        {children}
      </select>
      <span className="select-arrow">▼</span>
    </div>
  )
}
