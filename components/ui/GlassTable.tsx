export default function GlassTable({ columns, rows }: { columns: string[], rows: React.ReactNode[][] }) {
  return (
    <div className="glass-panel" style={{borderRadius:'var(--radius-large)',padding:'8px'}}>
      <table className="glass-table">
        <thead>
          <tr>
            {columns.map(c => <th key={c}>{c}</th>)}
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

