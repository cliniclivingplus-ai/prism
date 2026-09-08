-- Keyword -> hyperlink bank for the lifestyle/meal guideline editor's
-- auto-link feature. Seeded from the clinic's own historical PDF exports
-- (~1,450 real keyword/URL pairs already used across past guidelines —
-- product links, exercise videos, recipe sources), then grows in normal
-- use: every link a coach creates with LinkInsertButton is also POSTed to
-- /api/compass/keyword-links, so the bank only gets richer over time.
--
-- keyword_norm is the matching key (lowercased, trimmed) — case-insensitive
-- lookup without a functional index quirk. keyword keeps the original
-- casing for display in the picker. One (keyword_norm, url) pair is unique
-- so the same phrase can point at more than one real link (e.g. a YouTube
-- demo and an Amazon product) without collapsing them.
create table if not exists public.keyword_links (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  keyword_norm text not null,
  url text not null,
  source text,
  created_at timestamptz not null default now()
);

create unique index if not exists keyword_links_norm_url_idx
  on public.keyword_links (keyword_norm, url);

create index if not exists keyword_links_norm_idx
  on public.keyword_links (keyword_norm);
