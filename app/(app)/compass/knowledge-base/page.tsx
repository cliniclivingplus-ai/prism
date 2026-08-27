import KnowledgeBaseClient from './KnowledgeBaseClient'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export default async function KnowledgeBasePage() {
  const { data: documents } = await (await createClient())
    .from('kb_documents')
    .select('id, title, source_type, tags, created_at')
    .order('created_at', { ascending: false })

  return <KnowledgeBaseClient initialDocuments={documents ?? []} />
}
