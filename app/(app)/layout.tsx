import Sidebar from '@/components/ui/Sidebar'
import { requireUser } from '@/lib/auth/guard'

// Shared shell — the .app-shell flex layout from the mockups. Middleware
// gates this route group; requireUser() is the second check.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()

  return (
    // flex-col below md: the sidebar's mobile top bar (rendered by Sidebar
    // itself) needs to stack above the content, not sit beside it in a row
    // — the sidebar <aside> proper is `fixed` at that width anyway, so it
    // doesn't participate in this flow either way.
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar email={user.email ?? null} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
