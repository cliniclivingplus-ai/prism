import type { Metadata } from 'next'

// Patient-facing pages must never be indexed. A share link is a capability
// URL — if a crawler reaches one (forwarded in an email that lands in a
// public archive, pasted into a group chat with link previews), indexing
// would turn "unguessable" into "searchable". Also drops the clinician-app
// title, which the patient has no reason to see.
export const metadata: Metadata = {
  title: 'Your plan',
  robots: { index: false, follow: false, nocache: true },
}

// PUBLIC ROUTE GROUP — everything under /share is reachable without a login.
//
// This is the only unauthenticated surface in the app, and it exists on
// purpose: sharing the roadmap dashboard with the patient is the feature.
// Rules for anything added here:
//
//   * Resolve content by share_token via lib/share/publicData.ts. Never take
//     a row id from the URL, and never import lib/supabase/admin directly.
//   * No clinician navigation — the shell (Sidebar/Topbar) stays out, so a
//     patient page can never link into a gated surface.
//   * Treat every field as published to whoever holds the link.
export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[var(--background)]">{children}</div>
}
