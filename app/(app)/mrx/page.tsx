import { redirect } from 'next/navigation'

// MicrobiomeRx's own index used to redirect to /login — it was the tool's
// unauthenticated landing page. In the merged app this route is already
// behind the shared session, and the sidebar links here, so it lands on the
// tool's report list instead (mirroring /compass -> /compass/patients).
export default function MrxIndex() {
  redirect('/mrx/dashboard')
}
