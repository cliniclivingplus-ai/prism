-- The hub Dashboard/Patients roster (lib/clinical/roster.ts loadRoster())
-- currently lists every row in public.patients with no filter, which
-- includes patients that existed in the standalone pre-merge Compass tool.
-- The coach only wants patients deliberately created through the hub's own
-- "Add Patient" flow (POST /api/patients) to show there.
--
-- There was no column distinguishing the two, so this adds one. Every row
-- that exists at migration time is backfilled 'legacy' (it predates the
-- hub's own add-patient flow by definition, since that flow is the only
-- insert path into this table and it always sets source explicitly).
-- New rows default to 'hub' so nothing else has to set it, though
-- app/api/patients/route.ts now also sets it explicitly on insert.
--
-- Nothing is deleted. Legacy patients keep every row, report and link they
-- already have — this only changes which patients the roster LIST shows.
-- Visiting a legacy patient's own workspace page directly still works.

alter table public.patients add column if not exists source text;

update public.patients set source = 'legacy' where source is null;

alter table public.patients alter column source set default 'hub';
alter table public.patients alter column source set not null;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'patients_source_valid'
  ) then
    alter table public.patients
      add constraint patients_source_valid check (source in ('legacy', 'hub'));
  end if;
end $$;
