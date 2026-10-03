// Postgres rejects a NUL character inside text ("unsupported Unicode escape
// sequence", SQLSTATE 22P05), and so does its JSON parser for a broken
// surrogate pair. Both turn up in text pulled out of a PDF: a damaged or
// unusual font/CMap can map a glyph to U+0000, and OCR output can end up
// with half a surrogate pair. Either one made the whole upload fail at the
// insert, after the parsing and AI work had already been done.
//
// Everything extracted from a file — and anything derived from it by the
// model — goes through here before it is stored.

// Drops NULs and the other C0 control characters (tab, newline and carriage
// return are real text and stay), and any unpaired surrogate. A paired
// surrogate — a real emoji or non-BMP character — is left alone.
export function stripUnsafeChars(input: string): string {
  let out = ''
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i)
    if (code === 0) continue
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) continue
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = input.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += input[i] + input[i + 1]
        i++
      }
      continue
    }
    if (code >= 0xdc00 && code <= 0xdfff) continue
    out += input[i]
  }
  return out
}

// Same, applied to every string inside an object/array — AI output stored as
// jsonb (blood markers, report data, extracted supplements) carries the same
// risk as the raw text it was derived from.
export function sanitizeForDb<T>(value: T): T {
  if (typeof value === 'string') return stripUnsafeChars(value) as unknown as T
  if (Array.isArray(value)) return value.map((v) => sanitizeForDb(v)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[stripUnsafeChars(k)] = sanitizeForDb(v)
    }
    return out as unknown as T
  }
  return value
}
