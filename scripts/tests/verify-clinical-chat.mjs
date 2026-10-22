import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function load(file, mocks = {}, globals = {}) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports, require(name) { if (name in mocks) return mocks[name]; throw new Error(`Unexpected import: ${name}`) }, console, Response, URL, URLSearchParams, AbortSignal, setTimeout, clearTimeout, ...globals })
  return exports
}
const blank = { lifestyle: [], meals: [], weeklyFocus: [], supplements: [], avoid: [], notes: [] }
const completed = plan => ({ choices: [{ message: { content: JSON.stringify(plan) }, finish_reason: 'stop' }] })
let calls = []
const plan = load('lib/chatPlan.ts', { './groq': { groqChatCompletion: async args => { calls.push(args); return completed({ ...blank, lifestyle: ['Evening: Walk 10 minutes after dinner'], avoid: ['Do not fast'] }) } } })
assert.equal(plan.discussionTranscript([{ question: 'old interview', answer: 'old', mode: 'interview' }, { question: 'Walk 10 minutes after dinner', mode: 'discussion' }]), 'Coach: Walk 10 minutes after dinner')
assert.equal((await plan.distilAgreedPlan([{ question: 'Walk 10 minutes after dinner', mode: 'discussion' }], 'Test')).lifestyle[0], 'Evening: Walk 10 minutes after dinner')
assert.equal(calls.length, 1, 'Short concrete decisions must not be discarded')
calls = []
await plan.distilAgreedPlan([{ mode: 'discussion', question: 'x'.repeat(13000) + ' FINAL CORRECTION: no fasting' }], 'Test')
assert.equal(calls.length, 2)
assert.ok(calls[1].messages[1].content.includes('FINAL CORRECTION'))
assert.ok(calls[1].messages[1].content.includes('Walk 10 minutes'))
const broken = load('lib/chatPlan.ts', { './groq': { groqChatCompletion: async () => completed({}) } })
await assert.rejects(() => broken.distilAgreedPlan([{ mode: 'discussion', question: 'Use this plan' }], 'Test'), /Could not reliably extract/)

let fetched = ''
const evidence = load('lib/clinicalEvidence.ts', {}, { fetch: async url => {
  fetched = String(url)
  return Response.json({ resultList: { result: [
    { source: 'MED', id: '12345', title: 'A trial', abstractText: '<p>Trial results.</p>', pubYear: '2025' },
    { source: 'MED', id: 'javascript:bad', title: 'Bad', abstractText: 'Bad' },
    { source: 'MED', id: '23456', title: 'Retracted', abstractText: 'Bad', isRetracted: 'Y' },
  ] } })
} })
const result = await evidence.retrieveScientificEvidence('Jane Example, jane@example.com, DOB 2000-01-01, diabetes')
assert.equal(result.sources.length, 1)
assert.equal(result.sources[0].url, 'https://pubmed.ncbi.nlm.nih.gov/12345/')
assert.ok(!decodeURIComponent(fetched).includes('Jane'))
assert.ok(!fetched.includes('example.com'))
assert.ok(!fetched.includes('2000'))
assert.equal(evidence.literatureQuery('Patient name only'), '')
const offline = load('lib/clinicalEvidence.ts', {}, { fetch: async () => { throw new Error('offline') } })
assert.equal((await offline.retrieveScientificEvidence('diabetes')).sources.length, 0)

let chatRequest
let keywordSearch = ''
const chatDb = { from(table) {
  assert.ok(['kb_chunks', 'kb_documents'].includes(table), 'Chat must not write an existing patient dashboard')
  const q = { select() { return q }, in() { return q }, limit() { return q }, abortSignal() { return q }, textSearch(_column, query) { keywordSearch = query; return q },
    then(resolve, reject) { return Promise.resolve({ data: table === 'kb_chunks' ? [{ document_id: 'doc', content: 'IBS: synthetic reference excerpt. ' + 'a'.repeat(420) + 'SYNTHETIC ENDPOINT FACT' }] : [{ id: 'doc', title: 'Synthetic clinic document', source_type: 'clinic' }] }).then(resolve, reject) } }
  return q
} }
const chat = load('app/api/compass/qa-chat/route.ts', {
  '@/lib/clinicalEvidence': { retrieveScientificEvidence: async () => ({ context: '[SCI 1] Synthetic public abstract', sources: result.sources }) },
  '@/lib/groq': { groqChatCompletion: async args => { chatRequest = args; return { choices: [{ message: { content: 'A tentative option, with limitations [KB 1, SCI 1]. What constraints should we account for?' } }] } } },
  '@/lib/supabase': { supabaseAdmin: chatDb },
  '@/lib/embeddings': { embedText: async () => null, lastEmbeddingStatus: () => 'no-key' },
  '@/lib/dietRules': { DIET_RULE: 'Vegetarian', buildPlateRule: () => 'plate', DEFAULT_PLATE_COMPOSITION: {}, findNonVegTerm: () => null, stripDietLabels: s => s },
}, { setTimeout(fn, ms) { const timer = setTimeout(fn, ms); timer.unref(); return timer } })
const reply = await chat.POST({ json: async () => ({ mode: 'chat', messages: [{ role: 'assistant', content: 'Shall we discuss IBS and FODMAP options?' }, { role: 'user', content: 'yes' }] }) })
const chatResult = await reply.json()
assert.equal(reply.status, 200)
assert.equal(chatResult.sources.length, 2, 'Combined citations must map back to both real retrieved references')
assert.ok(keywordSearch.includes('ibs'))
assert.ok(chatRequest.messages[0].content.includes('SYNTHETIC ENDPOINT FACT'), 'Relevant text beyond the old 350-character cutoff must survive')
assert.equal(chatResult.kbSearchDown, false, 'Working lexical fallback is not a total knowledge-base outage')

// Exercise the actual session PATCH with a stateful DB double: no real writes.
let saved = [{ mode: 'interview', question: 'Original patient history', answer: 'Retain' }]
let writeCount = 0
const db = { from() {
  let update, filter
  const q = { select() { return q }, eq(key, value) { if (key === 'qa_pairs') filter = value; return q }, is() { return q },
    update(value) { update = value; return q }, single: async () => ({ data: { qa_pairs: saved } }),
    maybeSingle: async () => { assert.equal(filter, JSON.stringify(saved)); saved = update.qa_pairs; writeCount++; return { data: { qa_pairs: saved } } } }
  return q
} }
const endpoint = load('app/api/compass/sessions/[id]/route.ts', { 'next/server': { NextResponse: Response }, '@/lib/supabase': { supabaseAdmin: db } })
const discussion = [{ question: 'Agree to walk', answer: 'Staged for generation', mode: 'discussion', sources: result.sources }]
let response = await endpoint.PATCH({ json: async () => ({ discussion_pairs: discussion, expected_discussion: [] }) }, { params: Promise.resolve({ id: 'fake-session' }) })
assert.equal(response.status, 200)
assert.equal(saved[0].answer, 'Retain')
assert.equal(saved[1].sources[0].url, result.sources[0].url)
saved = saved.map(pair => Object.fromEntries(Object.entries(pair).reverse()))
const extendedDiscussion = [...discussion, { mode: 'discussion', question: 'Change the walk to 10 minutes', answer: 'Agreed' }]
response = await endpoint.PATCH({ json: async () => ({ discussion_pairs: extendedDiscussion, expected_discussion: discussion }) }, { params: Promise.resolve({ id: 'fake-session' }) })
assert.equal(response.status, 200, 'JSONB object-key ordering must not cause a false conflict')
response = await endpoint.PATCH({ json: async () => ({ discussion_pairs: extendedDiscussion, expected_discussion: discussion }) }, { params: Promise.resolve({ id: 'fake-session' }) })
assert.equal(response.status, 200, 'Retry after a lost successful response is idempotent')
response = await endpoint.PATCH({ json: async () => ({ discussion_pairs: [], expected_discussion: [] }) }, { params: Promise.resolve({ id: 'fake-session' }) })
assert.equal(response.status, 409)
assert.equal(writeCount, 2, 'Stale tab must not overwrite another coach; identical retries must not write again')

// New daily content follows the discussion; no-plan backfills keep their old path.
let dailyCalls = 0
const daily = load('lib/pdf/generateDailyContent.ts', {
  '@/lib/groq': { groqChatCompletion: async args => { dailyCalls++; return args.response_format ? completed({ lifestyle: ['Evening: Walk 10 minutes'], meals: ['Breakfast: Oats'] }) : { choices: [{ message: { content: '8:00 AM — Breakfast' } }] } } },
  './generationExamples': { getGoodExample: async () => null },
  '@/lib/dietRules': { DIET_RULE: 'Vegetarian', stripDietLabels: s => s },
  './standardDailyContent': { STANDARD_LIFESTYLE_GUIDELINES: 'Morning: Fasting', STANDARD_MEAL_GUIDELINES: 'Breakfast: Standard' },
})
let output = await daily.generateDailyContent('Facts', '', undefined, undefined, undefined, { lifestyle: ['Evening: Walk 10 minutes'], meals: ['Breakfast: Oats'], block: 'Walk 10 minutes; no fasting; oats at breakfast' })
assert.equal(output.lifestyle_guidelines, 'Evening: Walk 10 minutes')
assert.ok(!output.lifestyle_guidelines.includes('Fasting'))
assert.equal(output.meal_guidelines, 'Breakfast: Oats')
assert.equal(dailyCalls, 2)
dailyCalls = 0
output = await daily.generateDailyContent('Facts', '')
assert.equal(output.lifestyle_guidelines, 'Morning: Fasting')
assert.equal(dailyCalls, 1)
assert.ok(!fs.readFileSync('app/api/compass/qa-chat/route.ts', 'utf8').includes('.update({ guide_overrides:'))
assert.ok(!fs.readFileSync('app/api/compass/interpret/route.ts', 'utf8').includes("const { data: fb }"))
console.log('Clinical chat checks passed: short/long plans, fail-closed extraction, private literature queries, source links, save conflicts, legacy history, daily handoff and unchanged no-plan backfill.')
