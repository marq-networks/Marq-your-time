'use client'

import React from 'react'
import GlassInput from '@/components/ui/GlassInput'
import { Search, X } from 'lucide-react'

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function SearchInput({ value, onChange, className, ...rest }: Props) {
  return (
    <div className={`relative group ${className || ''}`}>
      <GlassInput
        value={value}
        onChange={onChange}
        placeholder="Search..."
        className="pl-10 pr-8 w-full transition-all duration-300 focus:bg-white/60 hover:bg-white/40"
        {...rest}
      />
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40 group-focus-within:text-primary transition-colors" />
      
      {value && (
        <button
          onClick={() => onChange({ target: { value: '' } } as any)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-black/40 hover:text-black rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
