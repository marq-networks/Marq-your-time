import SidebarNav from './SidebarNav'
import TopBar from './TopBar'

export default function AppShell({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="app-bg">
      <div className="shell">
        <div className="shell-side"><SidebarNav /></div>
        <div className="shell-main">
          <TopBar title={title} />
          <div className="shell-content">{children}</div>
        </div>
      </div>
    </div>
  )
}

