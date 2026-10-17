// Clinic-wide settings a coach edits in the app (Compass → Founder's note),
// rather than copy living in the code.
//
// Every read falls back to the built-in default, so the app behaves
// correctly before migration_v44_clinic_settings.sql has been run, if the
// row has never been saved, or if the table is unreachable. A patient-facing
// page must never fail because a setting is missing.
import { supabaseAdmin } from './supabase'

export const FOUNDER_NOTE_SETTING_KEY = 'founder_note_default'

// {first_name} and {goal} are filled in per patient when the note is shown.
// A coach can move them, or remove them for a note that reads the same for
// everyone.
export const FOUNDER_NOTE_TOKENS = ['{first_name}', '{goal}'] as const

// The clinic's standard welcome note. Used until a coach saves their own.
export const DEFAULT_FOUNDER_NOTE_TEMPLATE = [
  `🔴🔴🔴`,
  `{first_name}, wishing you Most and More.`,
  `This plan wasn't pulled from a template. It was built around your life: your mornings, your meals, your cravings, your goals.`,
  `From today, picture us lining the route of your race. Every balanced plate, every glass of water, every craving you outsmart, we're cheering. Quietly, constantly, even on the days you can't hear us. And when a day goes sideways, we're right there saying, "Keep going. You've got this."`,
  `Now picture the finish line: {goal}. We can already see you there.`,
  `And when you cross it? We'll be waiting with confetti in hand, ready to celebrate the new you. 🎉`,
  `A question, a wobble, or a win to share? Message us anytime. We're one tap away.`,
  `Let's go! 💛`,
  `Roshni & the Living Plus team.`,
].join('\n\n')

export async function readFounderNoteTemplate(): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin
      .from('clinic_settings')
      .select('value')
      .eq('key', FOUNDER_NOTE_SETTING_KEY)
      .maybeSingle()
    if (error || !data) return DEFAULT_FOUNDER_NOTE_TEMPLATE
    const text = typeof data.value === 'string' ? data.value : (data.value as { text?: string })?.text
    return typeof text === 'string' && text.trim() ? text : DEFAULT_FOUNDER_NOTE_TEMPLATE
  } catch {
    return DEFAULT_FOUNDER_NOTE_TEMPLATE
  }
}

// Fills the tokens for one patient. A goal we do not have is written as the
// clinic's own wording rather than left as an empty gap or an invented aim.
export function renderFounderNote(template: string, firstName: string, goalLabel: string): string {
  const goal = goalLabel.trim()
    ? goalLabel.trim().replace(/\.$/, '')
    : 'feeling energised, your fittest self, enjoying meals without cravings or bloating'
  const name = firstName.trim()
  let out = template.replace(/\{goal\}/g, goal)
  if (name) {
    out = out.replace(/\{first_name\}/g, name)
  } else {
    // No name on the record: drop the greeting rather than address the
    // patient as "Hello" or leave a stray comma, and restore the capital
    // the name was carrying — on the paragraph the name was in, which is
    // not always the first one (the note may open with a flourish above it).
    out = out
      .split('\n\n')
      .map((para) => {
        if (!para.includes('{first_name}')) return para
        const stripped = para
          .replace(/\{first_name\}\s*,\s*/g, '')
          .replace(/\{first_name\}/g, '')
          .replace(/^\s*,\s*/, '')
          .trim()
        return stripped.charAt(0).toUpperCase() + stripped.slice(1)
      })
      .join('\n\n')
  }
  return out.trim()
}
