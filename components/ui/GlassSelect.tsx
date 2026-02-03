// components/ui/GlassSelect.tsx
'use client'

import React from 'react'
import { ChevronDown } from 'lucide-react'

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & { children?: React.ReactNode }

export default function GlassSelect({ className, children, icon: Icon, ...rest }: Props & { icon?: React.ElementType }) {
  return (
    <div className="relative inline-flex items-center w-full group">
      {Icon && (
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-hover:text-gray-700 transition-colors pointer-events-none z-10" />
      )}
      <select
        {...rest}
        className={`
          appearance-none w-full 
          bg-white/50 hover:bg-white/70 focus:bg-white/90 
          backdrop-blur-md 
          border border-white/20 hover:border-white/40 focus:border-indigo-500/50
          text-gray-700 font-medium
          rounded-xl 
          py-2.5 ${Icon ? 'pl-10' : 'pl-4'} pr-10 
          shadow-sm hover:shadow-md focus:shadow-lg focus:ring-4 focus:ring-indigo-500/10
          transition-all duration-200 ease-in-out
          outline-none
          cursor-pointer
          ${className || ''}
        `}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors pointer-events-none" />
    </div>
  )
}
