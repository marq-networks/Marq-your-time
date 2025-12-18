'use client'

export default function GlassButton({ children, onClick, variant='primary', className, href, style, disabled }: { children: React.ReactNode, onClick?: () => void, variant?: 'primary'|'secondary', className?: string, href?: string, style?: React.CSSProperties, disabled?: boolean }) {
  const cls = variant==='primary' ? 'btn-glass primary' : 'btn-glass'
  if (href) return <a href={href} className={`${cls}${className?` ${className}`:''}`} style={style}>{children}</a>
  return <button className={`${cls}${className?` ${className}`:''}`} onClick={onClick} style={style} disabled={disabled}>{children}</button>
}
