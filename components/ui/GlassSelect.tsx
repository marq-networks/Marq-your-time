// components/ui/GlassSelect.tsx
'use client'

import React from 'react'
import { ChevronDown } from 'lucide-react'

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & { children?: React.ReactNode }

export default function GlassSelect({ className, children, ...rest }: Props) {
  return (
    <div className="relative inline-flex items-center w-full">
      <select
        {...rest}
        className={`glass-select appearance-none w-full pr-10 ${className || ''}`}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50 pointer-events-none text-[#1f1f1f]" />
    </div>
  )
}
