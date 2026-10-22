// Public literature searches contain only recognised clinical topics, never
// patient names, transcripts, dates, contact details, or free-form chat text.
export type ClinicalSource = { title: string; source_type: string; url?: string; citation?: string }
const TOPICS = [
  'insulin resistance', 'diabetes', 'polycystic ovary syndrome', 'pcos',
  'irritable bowel syndrome', 'ibs', 'fodmap', 'constipation', 'bloating',
  'hypothyroidism', 'thyroid', 'hypertension', 'cholesterol', 'obesity',
  'menopause', 'sleep', 'exercise', 'dietary fiber', 'protein', 'vitamin d',
  'vitamin b12', 'iron deficiency', 'fatty liver', 'celiac', 'probiotics',
  'reflux', 'migraine', 'endometriosis', 'kidney disease',
]
export function literatureQuery(text: string): string {
  const lower = text.toLowerCase()
  const terms = TOPICS.filter(t => new RegExp(`\\b${t}\\b`, 'i').test(lower)).slice(0, 3)
  return terms.length ? terms.map(t => `TITLE_ABS:"${t}"`).join(' AND ') : ''
}

function abstractExcerpt(text: string): string {
  const clean = text.replace(/<[^>]*>/g, ' ')
  return clean.length <= 1800 ? clean : `${clean.slice(0, 600)} [excerpt omitted] ${clean.slice(-1200)}`
}

export async function retrieveScientificEvidence(text: string): Promise<{ context: string; sources: ClinicalSource[] }> {
  const query = literatureQuery(text)
  if (!query) return { context: '', sources: [] }
  try {
    const url = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search')
    url.search = new URLSearchParams({ query: `${query} AND HAS_ABSTRACT:Y AND SRC:MED AND (PUB_TYPE:"Systematic Review" OR PUB_TYPE:"Meta-Analysis" OR PUB_TYPE:"Practice Guideline" OR PUB_TYPE:"Randomized Controlled Trial") NOT PUB_TYPE:"Retracted Publication"`, format: 'json', resultType: 'core', pageSize: '2' }).toString()
    const response = await fetch(url, { signal: AbortSignal.timeout(4000), cache: 'no-store' })
    if (!response.ok) return { context: '', sources: [] }
    const json = await response.json()
    const records = (json.resultList?.result ?? []) as { id?: string; source?: string; title?: string; abstractText?: string; pubYear?: string; isRetracted?: string }[]
    const sources: ClinicalSource[] = []
    const excerpts: string[] = []
    for (const record of records) {
      if (record.source !== 'MED' || !/^\d+$/.test(record.id ?? '') || !record.title || !record.abstractText || record.isRetracted === 'Y') continue
      const citation = `SCI ${sources.length + 1}`
      sources.push({ title: `${record.title}${record.pubYear ? ` (${record.pubYear})` : ''}`, source_type: 'scientific_abstract', url: `https://pubmed.ncbi.nlm.nih.gov/${record.id}/`, citation })
      excerpts.push(`[${citation}] ${record.title}\n${abstractExcerpt(record.abstractText)}`)
    }
    return { context: excerpts.join('\n\n'), sources }
  } catch {
    return { context: '', sources: [] }
  }
}
