-- Adds a dedicated daily_schedule column — the AI-generated, personalized
-- hour-by-hour timeline (distinct from guide_overrides.daily_schedule,
-- which is the coach's own manual override and already existed). Same
-- pattern as v37's meal_guidelines: additive, nullable, existing rows
-- untouched. buildGuideData() falls back to a hardcoded generic day
-- (STANDARD_DAILY_SCHEDULE) when both this and the override are empty, so
-- the section is never blank even before this migration runs or before a
-- roadmap is ever refreshed.
alter table public.roadmaps
  add column if not exists daily_schedule text;

alter table public.roadmap_versions
  add column if not exists daily_schedule text;
