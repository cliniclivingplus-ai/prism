import { redirect } from 'next/navigation'

// Blood Panel's own index used to redirect to /login — its unauthenticated
// landing before the merge. This route is already behind the shared session,
// and the sidebar links here, so it lands on the tool's patient list instead
// (mirroring /compass and /mrx).
export default function BloodIndex() {
  redirect('/blood/dashboard')
}
