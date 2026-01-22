'use client'

import React from 'react'
import GlassSelect from '@/components/ui/GlassSelect'

interface Option {
  label: string
  value: string
}

interface Props {
  label?: string
  options: Option[]
  value: string
  onChange: (value: string) => void
}

export default function SortSelect({ label, options, value, onChange }: Props) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-xs font-semibold uppercase tracking-wider text-[#1f1f1f]/50 ml-1">{label}</label>}
      <GlassSelect
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm h-[40px]"
      >
        <option value="" disabled>Sort by...</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </GlassSelect>
    </div>
  )
}
