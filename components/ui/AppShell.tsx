import SidebarNav from './SidebarNav'
import TopBar from './TopBar'

export default function AppShell({ title, children, userImage }: { title: string, children: React.ReactNode, userImage?: string }) {
  return (
    <div className="app-bg">
      <div className="shell">
        <div className="shell-side"><SidebarNav /></div>
        <div className="shell-main">
          <TopBar title={title} profileImage={userImage} />
          <div className="shell-content">{children}</div>
        </div>
      </div>
    </div>
  )
}

