import Sidebar from '@/components/ui/Sidebar'
import { requireUser } from '@/lib/auth/guard'
import { createClient } from '@/lib/supabase/server'

// Shared shell — the .app-shell flex layout from the mockups. Middleware
// gates this route group; requireUser() is the second check.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()

  const supabase = await createClient('compass')
  const { count } = await supabase.from('patients').select('id', { count: 'exact', head: true })

  return (
    <div className="flex min-h-screen">
      <Sidebar email={user.email ?? null} patientCount={count ?? null} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
