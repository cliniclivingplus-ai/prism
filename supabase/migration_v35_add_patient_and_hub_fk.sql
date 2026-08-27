-- migration_v35_add_patient_and_hub_fk.sql
--
-- Two additive changes. Nothing here rewrites, backfills or migrates a single
-- existing row: every column added is nullable with no default, so the 67
-- existing patients and 207 existing mrx.reports are untouched and keep
-- behaving exactly as they do today (see "Known data-quality issues" in
-- CLAUDE.md — the name-based fallback stays permanent for those records).
--
-- 1. Fields the Add Patient form captures that public.patients had nowhere to
--    put: program, allergies, and age.
--
--    `age_years` rather than a derived date_of_birth: clinics commonly record
--    age, not DOB, and inventing a birth date from an age would be fabricating
--    a clinical fact. date_of_birth stays the preferred source when known —
--    the workspace derives age from it first and falls back to age_years.
--
-- 2. `mrx.reports.clp_patient_id` — an explicit, unambiguous foreign key from
--    a stool-panel report to the hub patient record. This is the column that
--    makes "linked by real id, never by name" possible for everything uploaded
--    from now on.

-- ── 1. Add Patient fields ───────────────────────────────────────────────────
alter table public.patients
  add column if not exists program    text,
  add column if not exists allergies  text,
  add column if not exists age_years  integer;

comment on column public.patients.program is
  'Care programme name, e.g. "Gut Reset — Ph.2". Free text; no controlled list yet.';
comment on column public.patients.allergies is
  'Known allergies, free text. NULL means "not recorded", not "none known".';
comment on column public.patients.age_years is
  'Age in years, used when date_of_birth is unknown. Prefer date_of_birth.';

-- Guard against obvious data-entry slips without being clever about it.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'patients_age_years_sane'
  ) then
    alter table public.patients
      add constraint patients_age_years_sane
      check (age_years is null or (age_years >= 0 and age_years < 130));
  end if;
end $$;

-- ── 2. Hub foreign key on MicrobiomeRx reports ──────────────────────────────
alter table mrx.reports
  add column if not exists clp_patient_id uuid;

comment on column mrx.reports.clp_patient_id is
  'Hub FK -> public.patients(id). Set for every report uploaded after v35. '
  'NULL on the 207 historical rows, which are resolved by the documented '
  'name-based fallback instead. Never backfill this by name-matching.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reports_clp_patient_id_fkey'
  ) then
    alter table mrx.reports
      add constraint reports_clp_patient_id_fkey
      foreign key (clp_patient_id) references public.patients(id)
      on delete set null;
  end if;
end $$;

create index if not exists reports_clp_patient_id_idx
  on mrx.reports (clp_patient_id);
