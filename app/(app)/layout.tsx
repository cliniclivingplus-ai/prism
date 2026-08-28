import Sidebar from '@/components/ui/Sidebar'
import { requireUser } from '@/lib/auth/guard'

// Shared shell — the .app-shell flex layout from the mockups. Middleware
// gates this route group; requireUser() is the second check.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()

  return (
    <div className="flex min-h-screen">
      <Sidebar email={user.email ?? null} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
