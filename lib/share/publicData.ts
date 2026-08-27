import { createAdminClient } from '@/lib/supabase/admin'

// The ONLY module allowed to read data on behalf of an unauthenticated
// visitor. Three rules hold here, and the /share routes must not bypass them:
//
//   1. Resolve by share_token, never by row id, and always exclude revoked
//      links. The token is the capability; the id is not.
//   2. Never select('*'). Every column that reaches a patient's browser is
//      listed explicitly below, so adding a clinical-notes column to a table
//      can't silently publish it.
//   3. Never return staff contact details. Compass's public dashboard joined
//      in nutritionists.email; the coach's display name and photo are enough
//      for a patient-facing page.
//
// Returns null for missing, revoked, or malformed tokens alike — callers
// should render the same notFound() for all three so the endpoint can't be
// used to probe which tokens exist.

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

export function isWellFormedToken(token: string): boolean {
  return TOKEN_RE.test(token)
}

export type PublicRoadmap = {
  id: string
  week_count: number | null
  created_at: string
  patient_first_name: string | null
  coach_name: string | null
  coach_photo_url: string | null
}

export async function getSharedRoadmap(token: string): Promise<PublicRoadmap | null> {
  if (!isWellFormedToken(token)) return null

  const supabase = createAdminClient('compass')
  const { data, error } = await supabase
    .from('roadmaps')
    .select(
      'id, week_count, created_at, patients(full_name), nutritionists(full_name, photo_url)'
    )
    .eq('share_token', token)
    .is('share_revoked_at', null)
    .maybeSingle()

  if (error || !data) return null

  // PostgREST types an embedded relation as an array; a to-one join still
  // arrives as a single object at runtime. Normalise both shapes.
  const one = <T,>(rel: T | T[] | null): T | null =>
    Array.isArray(rel) ? (rel[0] ?? null) : rel

  const patient = one(data.patients) as { full_name: string | null } | null
  const coach = one(data.nutritionists) as
    | { full_name: string | null; photo_url: string | null }
    | null

  return {
    id: data.id,
    week_count: data.week_count ?? null,
    created_at: data.created_at,
    // First name only — a forwarded link shouldn't carry a full legal name.
    patient_first_name: patient?.full_name?.trim().split(/\s+/)[0] ?? null,
    coach_name: coach?.full_name ?? null,
    coach_photo_url: coach?.photo_url ?? null,
  }
}

export async function revokeRoadmapShare(roadmapId: string): Promise<void> {
  const supabase = createAdminClient('compass')
  await supabase
    .from('roadmaps')
    .update({ share_revoked_at: new Date().toISOString() })
    .eq('id', roadmapId)
}

// ── Token → row id resolution ────────────────────────────────────────
// The /api/share/** handlers take a share_token from the URL and need the
// underlying row id to do their work. Resolution happens here so the token
// check (well-formed + exists + not revoked) can't be skipped by a handler.
// Returns null for missing / revoked / malformed alike.

async function resolveId(
  table: 'roadmaps' | 'consultation_checklists',
  token: string
): Promise<string | null> {
  if (!isWellFormedToken(token)) return null

  const supabase = createAdminClient('compass')
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('share_token', token)
    .is('share_revoked_at', null)
    .maybeSingle()

  if (error || !data) return null
  return data.id as string
}

export function resolveRoadmapId(token: string) {
  return resolveId('roadmaps', token)
}

export function resolveChecklistId(token: string) {
  return resolveId('consultation_checklists', token)
}
