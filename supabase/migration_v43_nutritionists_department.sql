-- Adds a department to each coach/staff entry so the patient-workspace
-- "Add team member" picker can group people by department (Medical,
-- Front desk, etc.) instead of a coach retyping name/role/intro by hand
-- for every patient. Nullable, no default — existing rows (Padma,
-- Shakthi, shak, Bhavana, sha) are untouched and simply show with no
-- department until someone edits them on the Coaches page.
alter table public.nutritionists add column if not exists department text;
