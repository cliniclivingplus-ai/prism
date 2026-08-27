import { requireUser } from '@/lib/auth/guard'

// The patient workspace supplies its own patient-scoped sidebar (see
// components/ui/PatientSidebar), so this group deliberately does not render
// the global shell from (app)/layout.tsx. Route groups don't affect the URL,
// so these pages still live at /patients/**, and middleware still gates them.
export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  await requireUser()
  return <div className="flex min-h-screen">{children}</div>
}
