import Sidebar from '@/components/ui/Sidebar'
import { requireUser } from '@/lib/auth/guard'
import { createClient } from '@/lib/supabase/server'

// Shared shell — the .app-shell flex layout from the mockups. Middleware
// gates this route group; requireUser() is the second check.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()

  const supabase = await createClient('compass')
  // source = 'hub' matches loadRoster()'s own filter — otherwise this
  // badge would count every legacy Compass patient too, disagreeing with
  // the roster page's own "Total patients" stat right below it.
  const { count } = await supabase
    .from('patients')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'hub')

  return (
    <div className="flex min-h-screen">
      <Sidebar email={user.email ?? null} patientCount={count ?? null} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
