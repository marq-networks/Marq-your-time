'use client'


export default function GlassButton({ children, onClick, variant='primary', className, href, style, disabled, size }: { children: React.ReactNode, onClick?: () => void, variant?: 'primary'|'secondary'|'ghost', className?: string, href?: string, style?: React.CSSProperties, disabled?: boolean, size?: 'sm'|'md'|'lg' }) {
  const cls = `btn-glass ${variant} ${size || ''}`
  if (href) return <a href={href} className={`${cls}${className?` ${className}`:''}`} style={style}>{children}</a>
  return <button className={`${cls}${className?` ${className}`:''}`} onClick={onClick} style={style} disabled={disabled}>{children}</button>
}
