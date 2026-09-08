import { supabaseAdmin } from '@/lib/supabase'

export type GenerationKind = 'daily_schedule' | 'lifestyle_guidelines' | 'meal_guidelines'

// override key differs from the AI column name only for lifestyle
// (guide_overrides.daily_lifestyle_guidelines vs. roadmap.lifestyle_guidelines)
const OVERRIDE_KEY: Record<GenerationKind, string> = {
  daily_schedule: 'daily_schedule',
  lifestyle_guidelines: 'daily_lifestyle_guidelines',
  meal_guidelines: 'meal_guidelines',
}

// Finds a recent roadmap where a coach saved this field WITHOUT changing
// it from the AI's original output — the clearest available "this was
// good enough as written" signal, since a coach who saves a form always
// writes every field (see DashboardClient's save()), so an unedited field
// specifically means they looked at it and left it alone. Returned as a
// short few-shot example for future generations of the same kind — see
// generateDailyContent.ts. Real clinical content from this clinic's own
// data, used only as an internal style reference for the same internal
// generation call that already sends full patient facts to Groq.
export async function getGoodExample(kind: GenerationKind): Promise<string | null> {
  const aiColumn = kind
  const overrideKey = OVERRIDE_KEY[kind]

  const { data, error } = await supabaseAdmin
    .from('roadmaps')
    .select(`${aiColumn}, guide_overrides`)
    .not(aiColumn, 'is', null)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error || !data) return null

  type Row = { guide_overrides: Record<string, string> | null } & Record<string, unknown>
  for (const row of data as unknown as Row[]) {
    const original = String(row[aiColumn] ?? '').trim()
    const saved = String(row.guide_overrides?.[overrideKey] ?? '').trim()
    if (original && saved && original === saved) return original
  }
  return null
}

// Logs a coach's edit away from the AI's original text for later human
// review (see migration_v41's comment) — never read back into a prompt
// automatically. Fire-and-forget: a logging failure must never block the
// coach's actual save.
export async function logGenerationEdit(roadmapId: string, kind: GenerationKind, original: string, edited: string) {
  try {
    await supabaseAdmin.from('generation_edits').insert({ roadmap_id: roadmapId, kind, original, edited })
  } catch {
    // best-effort only
  }
}
