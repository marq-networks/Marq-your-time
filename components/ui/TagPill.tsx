export default function TagPill({ children, tone='accent' }: { children: React.ReactNode, tone?: 'accent'|'muted'|'danger' }) {
  return (
    <span className={`tag-pill ${tone}`}>{children}</span>
  )
}

