'use client'

import React from 'react'
import { Check } from 'lucide-react'

interface Option {
  label: string
  value: string
  color?: string // Optional color class or hex
}

interface Props {
  label?: string
  options: Option[]
  value: string | null
  onChange: (value: string | null) => void
}

export default function StatusPills({ label, options, value, onChange }: Props) {
  return (
    <div className="space-y-3">
      {label && <label className="text-xs font-semibold uppercase tracking-wider text-[#1f1f1f]/50 ml-1">{label}</label>}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onChange(null)}
          className={`
            relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border flex items-center gap-1.5
            ${!value 
              ? 'bg-white/60 border-white/40 text-[#1f1f1f] shadow-sm ring-1 ring-white/40' 
              : 'bg-transparent border-black/10 text-[#1f1f1f]/50 hover:bg-black/5 hover:text-[#1f1f1f]/80'
            }
          `}
        >
          {!value && <Check className="w-3 h-3" />}
          All
        </button>
        {options.map(option => {
          const isActive = value === option.value
          return (
            <button
              key={option.value}
              onClick={() => onChange(isActive ? null : option.value)}
              className={`
                relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border flex items-center gap-1.5
                ${isActive 
                  ? 'bg-primary/10 border-primary/50 text-primary shadow-sm ring-1 ring-primary/20' 
                  : 'bg-transparent border-black/10 text-[#1f1f1f]/50 hover:bg-black/5 hover:text-[#1f1f1f]/80'
                }
              `}
            >
              {isActive && <Check className="w-3 h-3" />}
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
