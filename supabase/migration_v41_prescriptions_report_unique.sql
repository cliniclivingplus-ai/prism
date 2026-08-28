-- mrx/report/[id]/review's saveDraft() falls back to
-- upsert(..., {onConflict:'report_id'}) whenever the page hasn't already
-- loaded an existing prescription for this report (the first save on a
-- report, or a page reload before one exists). Postgres requires a real
-- unique constraint or index backing an ON CONFLICT target — there wasn't
-- one on mrx.prescriptions.report_id, so every such save failed with 42P10
-- ("no unique or exclusion constraint matching the ON CONFLICT
-- specification") and doctors could not approve a prescription.
--
-- A report has exactly one prescription, so this is a true 1:1 and the
-- fix is a plain unique index, not a partial one like v40's checkin case.

-- Defensive: keeps the earliest row per report_id. Multiple rows for the
-- same report could only have come from two racing first-saves (the same
-- failure this migration fixes), so the survivor carries no less
-- information than the others.
delete from mrx.prescriptions a
using mrx.prescriptions b
where a.id > b.id
  and a.report_id = b.report_id;

create unique index if not exists prescriptions_report_id_unique
  on mrx.prescriptions (report_id);
