alter table public.projects
  add column if not exists assigned_staff_ids uuid[] not null default '{}';

create index if not exists projects_assigned_staff_ids_idx
  on public.projects using gin (assigned_staff_ids);
