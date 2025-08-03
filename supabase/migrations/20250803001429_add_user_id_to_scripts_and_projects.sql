alter table scripts
  add column if not exists user_id uuid not null default auth.uid();

alter table projects
  add column if not exists user_id uuid not null default auth.uid();

alter table scripts enable row level security;
alter table projects enable row level security;

create policy "scripts_select" on scripts
  for select using (user_id = auth.uid());

create policy "scripts_insert" on scripts
  for insert with check (user_id = auth.uid());

create policy "scripts_update" on scripts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "scripts_delete" on scripts
  for delete using (user_id = auth.uid());

create policy "projects_select" on projects
  for select using (user_id = auth.uid());

create policy "projects_insert" on projects
  for insert with check (user_id = auth.uid());

create policy "projects_update" on projects
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "projects_delete" on projects
  for delete using (user_id = auth.uid());
