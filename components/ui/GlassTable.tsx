export default function GlassTable({ columns, rows }: { columns: (string | { name: string, width?: string })[], rows: React.ReactNode[][] }) {
  return (
    <div className="glass-panel" style={{borderRadius:'var(--radius-large)',padding:'8px',overflowX:'auto'}}>
      <table className="glass-table">
        <thead>
          <tr>
            {columns.map((c, i) => {
              const name = typeof c === 'string' ? c : c.name
              const width = typeof c === 'object' ? c.width : undefined
              return <th key={i} style={{ width }}>{name}</th>
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r,i) => (
            <tr key={i}>
              {r.map((cell,j) => <td key={j}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}

