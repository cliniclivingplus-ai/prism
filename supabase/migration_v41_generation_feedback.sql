-- Two halves of "the daily-content generator should improve over time,"
-- both feasible without real fine-tuning (Groq's hosted openai/gpt-oss
-- models don't support it through this app):
--
-- 1. Few-shot from real good output: lib/pdf/generationExamples.ts reads
--    roadmap.daily_schedule / lifestyle_guidelines / meal_guidelines
--    (the AI's original) directly — no new table needed there, a roadmap
--    a coach saved WITHOUT changing that field (guide_overrides.<field>
--    still equal to the AI original) is itself the "good example" to show
--    future generations. This table isn't for that half.
--
-- 2. generation_edits logs the other half: whenever a coach's save
--    changes one of those three fields away from the AI's original text,
--    both versions are recorded here for a human to periodically read
--    through and spot real patterns ("coaches keep cutting this down,"
--    "coaches keep adding X") — then update the prompt in
--    generateDailyContent.ts by hand. Deliberately not auto-applied: a
--    single coach's one-off rewrite isn't a pattern, a human judgment
--    call is what turns a handful of these into a prompt change.
create table if not exists public.generation_edits (
  id uuid primary key default gen_random_uuid(),
  roadmap_id uuid references public.roadmaps(id) on delete cascade,
  kind text not null check (kind in ('daily_schedule', 'lifestyle_guidelines', 'meal_guidelines')),
  original text not null,
  edited text not null,
  created_at timestamptz not null default now()
);

create index if not exists generation_edits_kind_idx
  on public.generation_edits (kind, created_at desc);
