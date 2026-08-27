-- Daily Health Check-in redesign: a real, persisted, stable-ID'd checklist
-- instead of one recomputed live from confirmedSupplements+lifestyle_guidelines
-- on every render (see WeekTemplate.tsx pre-v39). Stable IDs are the point —
-- without them, a coach editing/reordering the list after a patient has
-- already checked items off would silently misattribute historical ticks to
-- different items (an item at position 2 today might not be the same item
-- that was at position 2 last week).
--
-- daily_checklist_items shape: [{ id, text, source: 'supplement'|'lifestyle'|'coach' }]
-- roadmaps.daily_checklist_items = the AI-generated version (Step 3E).
-- guide_overrides.daily_checklist_items = the coach's edited version (wins
-- when present), same override pattern as every other roadmap field.
alter table public.roadmaps
  add column if not exists daily_checklist_items jsonb;

alter table public.roadmap_versions
  add column if not exists daily_checklist_items jsonb;

-- roadmap_checkins gains item_id + a text snapshot taken at check time, so a
-- coach's progress view stays historically accurate even after the
-- checklist's wording changes later — and action_index becomes optional
-- (item-identified checkins don't have a stable position to record).
alter table public.roadmap_checkins
  add column if not exists item_id text,
  add column if not exists item_text_snapshot text;

alter table public.roadmap_checkins
  alter column action_index drop not null;
