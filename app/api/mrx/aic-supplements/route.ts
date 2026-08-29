// app/api/mrx/aic-supplements/route.ts
// AIC Supplement Recommendation Engine - v2.0.0
// Products fetched from Supabase aic_products table (not hardcoded)
// Rules engine (deterministic) -> Groq (writes clinical rationale only)

import { NextRequest, NextResponse } from 'next/server'
import { groqChatCompletion } from '@/lib/groq'
import { createClient } from '@supabase/supabase-js'
import {
  runAICSupplementRules,
  type AICProduct,
  type AICRecommendation,
  type AICRulesOutput,
} from '@/lib/mrx/aicSupplementRules'


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'mrx' } }
)

// --- Fetch all active AIC products from Supabase ----------------------------

async function fetchAICProducts(): Promise<AICProduct[]> {
  const { data, error } = await supabase
    .from('aic_products')
    .select('*')
    .eq('active', true)
    .order('phase', { ascending: true })

  if (error) throw new Error(`Failed to fetch AIC products: ${error.message}`)
  if (!data || data.length === 0) throw new Error('No active AIC products found. Run the seed SQL in Supabase first.')

  return data as AICProduct[]
}

// --- Write Groq rationale for a single recommendation -----------------------

async function writeRationale(rec: AICRecommendation): Promise<string> {
  try {
    const completion = await groqChatCompletion({
      model: 'openai/gpt-oss-20b',
      max_tokens: 180,
      temperature: 0.25,
      messages: [
        {
          role: 'system',
          content: [
            'You are a senior clinical gut microbiome specialist writing supplement rationales for a functional medicine doctor.',
            '',
            'VOICE: Confident, clinical, and hopeful. The patient has a clear problem and this supplement directly addresses it.',
            'Write as if explaining to a colleague - not hedging, not marketing.',
            '',
            'RULES:',
            '- Never use: "may", "might", "could", "perhaps", "possibly", "consider", "suggest"',
            '- Use instead: "is", "does", "directly", "addresses", "restores", "supports", "provides", "is indicated for"',
            '- Do NOT use the word "prescribe"',
            '- Frame findings as addressable, not alarming - the supplement is the solution',
            '- Be specific to the exact patient findings given - never generic',
            '- Maximum 3 sentences. Each sentence must add clinical value.',
            '- End with a forward-looking statement about what improves',
          ].join('\n'),
        },
        {
          role: 'user',
          content: rec.rationale_prompt,
        },
      ],
    })
    return completion.choices[0]?.message?.content?.trim() ?? ''
  } catch {
    return 'Rationale generation unavailable. Please review the triggered findings above.'
  }
}

// --- POST handler ------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const { report_id, report_data, regenerate = false } = await req.json()

    if (!report_id || !report_data) {
      return NextResponse.json(
        { error: 'report_id and report_data are required' },
        { status: 400 }
      )
    }

    // Return cached results if available (unless regenerate=true)
    if (!regenerate) {
      const { data: existing } = await supabase
        .from('reports')
        .select('aic_supplement_recommendations')
        .eq('id', report_id)
        .single()

      if (existing?.aic_supplement_recommendations) {
        return NextResponse.json({
          source: 'cache',
          ...existing.aic_supplement_recommendations,
        })
      }
    }

    // Step 1: Fetch AIC products from Supabase
    const products = await fetchAICProducts()

    // Step 2: Run deterministic rules engine
    const rulesOutput: AICRulesOutput = runAICSupplementRules(report_data, products)

    // Step 3: Collect all recommendations
    const allRecs: AICRecommendation[] = [
      ...rulesOutput.phase1,
      ...rulesOutput.phase2_infection_control,
      ...rulesOutput.phase2_probiotics,
      ...rulesOutput.phase2_nutrition,
      ...rulesOutput.phase3,
    ]

    // Step 4: Write Groq rationale sequentially
    for (const rec of allRecs) {
      rec.ai_rationale = await writeRationale(rec)
    }

    // Step 5: Merge rationales back into phase arrays
    const withRationale = (phase: AICRecommendation[]): AICRecommendation[] =>
      phase.map((r: AICRecommendation) => ({
        ...r,
        ai_rationale: allRecs.find(
          (a: AICRecommendation) => a.product_key === r.product_key
        )?.ai_rationale,
      }))

    // Step 6: Rebuild full output
    const fullOutput: AICRulesOutput = {
      ...rulesOutput,
      phase1:                   withRationale(rulesOutput.phase1),
      phase2_infection_control: withRationale(rulesOutput.phase2_infection_control),
      phase2_probiotics:        withRationale(rulesOutput.phase2_probiotics),
      phase2_nutrition:         withRationale(rulesOutput.phase2_nutrition),
      phase3:                   withRationale(rulesOutput.phase3),
    }

    // Step 7: Cache in Supabase
    await supabase
      .from('reports')
      .update({
        aic_supplement_recommendations: fullOutput,
        aic_rules_version:              fullOutput.version,
        updated_at:                     new Date().toISOString(),
      })
      .eq('id', report_id)

    return NextResponse.json({ source: 'generated', ...fullOutput })

  } catch (error) {
    console.error('[aic-supplements]', error)
    return NextResponse.json(
      {
        error:  error instanceof Error ? error.message : 'Failed to generate AIC supplement recommendations',
        detail: String(error),
      },
      { status: 500 }
    )
  }
}
