// components/ui/GlassInput.tsx
'use client'

import React from 'react'

type Props = React.InputHTMLAttributes<HTMLInputElement>

export default function GlassInput({ className, ...rest }: Props) {
  return <input {...rest} className={`input${className ? ` ${className}` : ''}`} />
}

