alter table pages
  add column if not exists user_id uuid not null default auth.uid();

alter table projects
  add column if not exists user_id uuid not null default auth.uid();

alter table pages enable row level security;
alter table projects enable row level security;

create policy "pages_select" on pages
  for select using (user_id = auth.uid());

create policy "pages_insert" on pages
  for insert with check (user_id = auth.uid());

create policy "pages_update" on pages
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "pages_delete" on pages
  for delete using (user_id = auth.uid());

create policy "projects_select" on projects
  for select using (user_id = auth.uid());

create policy "projects_insert" on projects
  for insert with check (user_id = auth.uid());

create policy "projects_update" on projects
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "projects_delete" on projects
  for delete using (user_id = auth.uid());
