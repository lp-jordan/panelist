alter table pages
  add column if not exists page_content jsonb;

alter table pages
  add column if not exists version integer not null default 1;
