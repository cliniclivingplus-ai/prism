// Shared by every Week-family template (WeekTemplate.tsx and its 7 reskinned
// clones) and the Classic editor's "Week-plan extras" panel, so a bullet
// list always splits into the same Morning/Afternoon/Evening (or
// Breakfast/Lunch/Dinner) groups on both the editing side and the
// patient-facing side — one source of truth, not two drifting copies.

export function parseBullets(text: string): string[] {
  return (text || '')
    .split(/\n|(?=•)/)
    .map((s) => s.replace(/^[•\-\s]+/, '').trim())
    .filter(Boolean)
}

export function splitKV(bullet: string): { k: string | null; v: string } {
  const m = bullet.match(/^([^:]{2,30}):\s*(.+)$/)
  return m ? { k: m[1].trim(), v: m[2].trim() } : { k: null, v: bullet }
}

// Keyword hints for sorting an unlabeled lifestyle/meal item into its most
// likely period — a real signal beats a coin flip, but an item with no
// signal at all still needs to land somewhere (see the round-robin
// fallback in groupBulletsByLabel below).
const PERIOD_KEYWORD_RULES: [RegExp, string][] = [
  [/\b(breakfast)\b/i, 'Breakfast'],
  [/\b(lunch|midday|noon)\b/i, 'Lunch'],
  [/\b(dinner|supper)\b/i, 'Dinner'],
  [/\b(morning|wake|sunrise|sunlight|fast(?:ing)?)\b/i, 'Morning'],
  [/\b(afternoon)\b/i, 'Afternoon'],
  [/\b(evening|night|sleep|bed\s*time|screen)\b/i, 'Evening'],
]
export function classifyByKeyword(text: string, labels: string[]): string | null {
  for (const [pattern, label] of PERIOD_KEYWORD_RULES) {
    if (labels.includes(label) && pattern.test(text)) return label
  }
  return null
}

// Daily lifestyle guidelines / meal guidelines are coach-editable free text,
// one item per line — a line can open a period group ("Morning: ...",
// "Breakfast: ...") to sort itself under that heading. An unlabeled line is
// still always sorted into one of the periods — by keyword hint first
// (falling back to spreading evenly across the periods for a genuinely
// generic line) — so this always splits into real Morning/Afternoon/Evening
// (or Breakfast/Lunch/Dinner) groups, never one undifferentiated list.
export function groupBulletsByLabel(text: string, labels: string[]): { label: string; items: string[] }[] {
  const bullets = parseBullets(text)
  const groups = new Map<string, string[]>(labels.map((l) => [l, []]))
  let roundRobin = 0
  for (const bullet of bullets) {
    const { k, v } = splitKV(bullet)
    const explicit = k ? labels.find((l) => l.toLowerCase() === k.toLowerCase()) : undefined
    const label = explicit ?? classifyByKeyword(bullet, labels) ?? labels[roundRobin++ % labels.length]
    groups.get(label)!.push(explicit ? v : bullet)
  }
  return labels.filter((l) => groups.get(l)!.length > 0).map((label) => ({ label, items: groups.get(label)! }))
}

// The editor-side split: every label always gets an entry (even an empty
// one), one bullet-per-line block of plain text with no "Label:" prefix —
// exactly what belongs in that period's own textarea.
export function splitIntoPeriods(text: string, labels: string[]): Record<string, string> {
  const groups = groupBulletsByLabel(text, labels)
  const byLabel = new Map(groups.map((g) => [g.label, g.items.join('\n')]))
  return Object.fromEntries(labels.map((l) => [l, byLabel.get(l) || '']))
}

// The reverse of splitIntoPeriods — reassembles the per-period textareas
// back into one "Label: item" string per line, the storage format
// groupBulletsByLabel/splitIntoPeriods both read.
export function joinPeriods(byPeriod: Record<string, string>, labels: string[]): string {
  return labels.flatMap((label) => parseBullets(byPeriod[label] || '').map((line) => `${label}: ${line}`)).join('\n')
}

// A schedule line is "<time> — <what happens>" (em dash or hyphen); a line
// with no separator still shows, just without a time badge, rather than
// being dropped.
export function parseScheduleLines(text: string): { time: string; text: string }[] {
  return parseBullets(text).map((line) => {
    const m = line.match(/^(.{1,12}?)\s*[—–-]\s*(.+)$/)
    return m ? { time: m[1].trim(), text: m[2].trim() } : { time: '', text: line }
  })
}
