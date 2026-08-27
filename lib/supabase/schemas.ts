// The three tools share one Supabase project (cliniclivingplus) and are
// isolated by schema. The schema is fixed at client-construction time, so
// every client factory takes one of these rather than defaulting silently.
export const SCHEMAS = {
  compass: 'public',
  mrx: 'mrx',
  blood: 'blood',
} as const

export type ToolKey = keyof typeof SCHEMAS
export type SchemaName = (typeof SCHEMAS)[ToolKey]
