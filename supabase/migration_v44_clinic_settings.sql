-- Clinic-wide settings a coach can edit from inside the app, instead of
-- them living in the code where only a developer can change them.
--
-- First use: the founder's note every new roadmap starts with. Previously
-- hard-coded in lib/pdf/buildGuideData.ts.
--
-- Additive and safe to run twice. The app falls back to its built-in
-- default when this table is missing or empty, so nothing breaks before or
-- after it is applied.

create table if not exists public.clinic_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

comment on table public.clinic_settings is
  'Clinic-wide, coach-editable settings. One row per setting key; value is jsonb so a setting can grow fields without a migration.';

-- Every signed-in coach may read and change these: they are clinic content
-- (copy shown to patients), not per-user data. Writes still go through the
-- gated API route, which is where the app enforces who may call it.
alter table public.clinic_settings enable row level security;

drop policy if exists "clinic_settings readable by authenticated" on public.clinic_settings;
create policy "clinic_settings readable by authenticated"
  on public.clinic_settings for select
  to authenticated
  using (true);

drop policy if exists "clinic_settings writable by authenticated" on public.clinic_settings;
create policy "clinic_settings writable by authenticated"
  on public.clinic_settings for all
  to authenticated
  using (true)
  with check (true);
