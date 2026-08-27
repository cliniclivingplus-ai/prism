-- A check-in is a boolean fact: this item, on this date, was ticked. Nothing
-- enforced that, so two POSTs for the same item landing together both found
-- nothing and both inserted (the toggle in
-- app/api/share/roadmap/[token]/checkins/route.ts and its authenticated twin
-- select-then-insert, with no constraint underneath).
--
-- The duplicate then became permanent: the lookup uses .maybeSingle(), which
-- errors on more than one row, and the route discarded that error — so the
-- handler read "no existing row", took the insert branch, and added another.
-- The item could never be un-ticked again, and every further tap made it
-- worse. The patient UI hid it (it builds a Set, which collapses duplicates)
-- but the coach's Daily Progress panel lists one line per row, so adherence
-- read higher than it really was.
--
-- Two partial indexes rather than one: a row is keyed by item_id (Daily
-- Health Check-in, week_number 0) or by action_index (weekly goals,
-- week_number >= 1), never both, and NULLs are not comparable in a unique
-- index — so a single index over both columns would not constrain either.

-- Defensive: the indexes below cannot build over existing duplicates. Keeps
-- the earliest row of each group, which is the one the patient actually
-- created; the rest are the artefacts of the race described above and carry
-- no information the survivor does not.
delete from public.roadmap_checkins a
using public.roadmap_checkins b
where a.id > b.id
  and a.roadmap_id = b.roadmap_id
  and a.week_number = b.week_number
  and a.checkin_date = b.checkin_date
  and a.item_id is not null
  and a.item_id = b.item_id;

delete from public.roadmap_checkins a
using public.roadmap_checkins b
where a.id > b.id
  and a.roadmap_id = b.roadmap_id
  and a.week_number = b.week_number
  and a.checkin_date = b.checkin_date
  and a.item_id is null
  and b.item_id is null
  and a.action_index is not null
  and a.action_index = b.action_index;

create unique index if not exists roadmap_checkins_item_unique
  on public.roadmap_checkins (roadmap_id, week_number, checkin_date, item_id)
  where item_id is not null;

create unique index if not exists roadmap_checkins_action_unique
  on public.roadmap_checkins (roadmap_id, week_number, checkin_date, action_index)
  where item_id is null and action_index is not null;
