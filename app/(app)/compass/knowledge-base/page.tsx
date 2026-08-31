import KnowledgeBaseClient from './KnowledgeBaseClient'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

const PAGE_SIZE = 100
// Kept in sync with app/api/compass/kb/route.ts's KNOWN_TYPES — that route
// handles "Load more" pagination client-side, this initial server load
// mirrors its same count-only-queries-against-the-whole-table approach so
// the header/stat tiles are accurate on first paint too, not just after
// a client-side refetch.
const KNOWN_TYPES = ['book', 'podcast', 'guideline', 'article', 'gemini-note', 'website', 'youtube']

export default async function KnowledgeBasePage() {
  const supabase = await createClient()

  const [{ data: documents }, { count: total }, typeCountEntries] = await Promise.all([
    supabase
      .from('kb_documents')
      .select('id, title, source_type, tags, created_at')
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1),
    supabase.from('kb_documents').select('id', { count: 'exact', head: true }),
    Promise.all(
      KNOWN_TYPES.map(async (type) => {
        const { count } = await supabase.from('kb_documents').select('id', { count: 'exact', head: true }).eq('source_type', type)
        return [type, count ?? 0] as const
      })
    ),
  ])

  const typeCounts: Record<string, number> = Object.fromEntries(typeCountEntries)
  const knownTotal = typeCountEntries.reduce((sum, [, n]) => sum + n, 0)
  typeCounts.other = (total ?? 0) - knownTotal

  return (
    <KnowledgeBaseClient
      initialDocuments={documents ?? []}
      initialTotal={total ?? 0}
      initialTypeCounts={typeCounts}
      pageSize={PAGE_SIZE}
    />
  )
}
