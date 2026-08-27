import Groq from 'groq-sdk'
import type { ExtractedMarker } from './types'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
const MAX_TEXT_CHARS = 12000

const SYSTEM_PROMPT = `You extract every lab test result from a blood/diagnostic report's raw text into structured JSON. The report may combine multiple unrelated panels (e.g. CBC, a hormone panel, a mineral panel) in one document — extract every test from every panel present. It may also contain long narrative "Interpretation"/"Result" prose sections — do not extract those as tests, only the actual named test result rows.

For each test, return:
- test_name: the test's own name as printed (e.g. "Hemoglobin", "HbA2", "Free Testosterone")
- result: the numeric or text result exactly as printed
- unit: the unit exactly as printed, or "" if none
- ref_range: the reference/normal range exactly as printed, or "" if none
- flag: whatever the report itself printed to mark this abnormal (e.g. "H", "L", "*", "High", "Low"), or "" if nothing was printed
- abnormal: true or false. Prefer the report's own printed flag if present. Only if no flag was printed AND the range is a clean numeric bound (e.g. "12-15"), compare the numeric result to that range yourself. If you cannot determine abnormality confidently, set false rather than guessing.

Never invent a test, result, or range that isn't in the text. Return strict JSON, nothing else: {"markers": [...]}`

function parseMarkersJson(raw: string): ExtractedMarker[] {
  let parsed: { markers?: unknown } = {}
  try {
    const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
    const match = clean.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(match ? match[0] : clean)
  } catch {
    parsed = {}
  }
  if (!Array.isArray(parsed.markers)) return []

  return parsed.markers
    .filter((m): m is Record<string, unknown> => typeof m === 'object' && m !== null)
    .map((m) => ({
      test_name: typeof m.test_name === 'string' ? m.test_name.trim() : '',
      result: typeof m.result === 'string' || typeof m.result === 'number' ? String(m.result).trim() : '',
      unit: typeof m.unit === 'string' ? m.unit.trim() : '',
      ref_range: typeof m.ref_range === 'string' ? m.ref_range.trim() : '',
      flag: typeof m.flag === 'string' ? m.flag.trim() : '',
      abnormal: m.abnormal === true,
    }))
    .filter((m) => m.test_name && m.result)
}

// Reports come from any lab in any layout, so extraction has to be
// LLM-driven rather than a fixed-position/regex parser (unlike
// MicrobiomeRX's BugSpeaks-specific parser, which can rely on one vendor's
// fixed template). `abnormal` prefers the report's own printed flag
// (H/L/asterisk/"High"/"Low") since that's already lab-verified; only when
// no flag was printed does the model fall back to comparing the numeric
// result against a clean numeric range.
//
// Deliberately NOT using Groq's strict json_object mode: side-by-side
// testing on a real 4-panel, 16-row report showed it either failed
// outright (400 json_validate_failed) or silently returned an incomplete
// list, while plain free-form generation reliably returned the full,
// correct 16-row list. parseMarkersJson's own regex extraction is lenient
// enough to pull the JSON out of a markdown-fenced or prose-wrapped reply.
//
// reasoning_effort: 'low' matters here — openai/gpt-oss-20b is a reasoning
// model on Groq, and its hidden reasoning tokens count against max_tokens.
// Without capping it, a moderately detailed prompt like this one burned
// the entire 4000-token budget on reasoning and returned finish_reason
// "length" with zero visible output. Same fix this codebase family
// already uses elsewhere for this model (e.g. CDB's ai-edit-field route).
export async function extractMarkers(rawText: string): Promise<ExtractedMarker[]> {
  try {
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      temperature: 0,
      max_tokens: 4000,
      reasoning_effort: 'low',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: rawText.slice(0, MAX_TEXT_CHARS) },
      ],
    })
    return parseMarkersJson(completion.choices[0]?.message?.content?.trim() ?? '{}')
  } catch {
    return []
  }
}
