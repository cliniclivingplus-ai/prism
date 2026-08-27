-- Share tokens for the patient-facing surface (/share/*).
--
-- Compass shared /dashboard/<roadmap uuid> and /checklist/<checklist uuid>
-- directly. gen_random_uuid() is 122 bits of randomness, so those URLs were
-- never enumerable — but the row id doubles as the capability, which means a
-- link can never be withdrawn without deleting clinical data, and a forwarded
-- link is permanent. These columns separate the two concerns.

alter table roadmaps
  add column if not exists share_token text unique,
  add column if not exists share_revoked_at timestamptz;

alter table consultation_checklists
  add column if not exists share_token text unique,
  add column if not exists share_revoked_at timestamptz;

-- 32 bytes of CSPRNG entropy, base64url, stripped of padding.
create or replace function gen_share_token() returns text
language sql volatile as $$
  select translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_');
$$;

alter table roadmaps
  alter column share_token set default gen_share_token();
alter table consultation_checklists
  alter column share_token set default gen_share_token();

-- Backfill existing rows so already-shared roadmaps keep working once the
-- /share routes go live in Step 2.
update roadmaps set share_token = gen_share_token() where share_token is null;
update consultation_checklists set share_token = gen_share_token() where share_token is null;

create index if not exists roadmaps_share_token_idx
  on roadmaps(share_token) where share_revoked_at is null;
create index if not exists consultation_checklists_share_token_idx
  on consultation_checklists(share_token) where share_revoked_at is null;
