-- migration_v36_blood_hub_fk.sql
--
-- The Blood Panel half of the "link by real id, never by name" rule that v35
-- established for MicrobiomeRx. Additive and nullable: no existing row is
-- rewritten, backfilled or migrated.
--
-- blood.reports already carries patient_id -> blood.patients(id), so an upload
-- was never name-matched. What it lacked is a key back to the *hub* record, so
-- the patient workspace could only reach a panel through the link table.
-- clp_patient_id closes that, exactly like mrx.reports.clp_patient_id.

alter table blood.reports
  add column if not exists clp_patient_id uuid;

comment on column blood.reports.clp_patient_id is
  'Hub FK -> public.patients(id). Set on every report uploaded from the '
  'patient workspace. Never backfill this by name-matching.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'blood_reports_clp_patient_id_fkey'
  ) then
    alter table blood.reports
      add constraint blood_reports_clp_patient_id_fkey
      foreign key (clp_patient_id) references public.patients(id)
      on delete set null;
  end if;
end $$;

create index if not exists blood_reports_clp_patient_id_idx
  on blood.reports (clp_patient_id);
