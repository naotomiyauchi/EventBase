-- 携帯イベント管理システム — 初期スキーマ

create type public.project_status as enum (
  'proposal',
  'ordered',
  'staffing',
  'in_progress',
  'completed',
  'invoiced'
);

create table public.carriers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references public.carriers (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null,
  address text,
  access_notes text,
  contact_name text,
  contact_phone text,
  entry_rules text,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores (id) on delete set null,
  title text not null,
  status public.project_status not null default 'proposal',
  start_at timestamptz,
  end_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  skills text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

create table public.project_attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  file_path text not null,
  original_name text,
  created_at timestamptz not null default now()
);

create or replace function public.set_projects_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_updated_at
  before update on public.projects
  for each row
  execute function public.set_projects_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

alter table public.carriers enable row level security;
alter table public.agencies enable row level security;
alter table public.stores enable row level security;
alter table public.projects enable row level security;
alter table public.staff enable row level security;
alter table public.profiles enable row level security;
alter table public.project_attachments enable row level security;

create policy "carriers_authenticated_all" on public.carriers
  for all to authenticated using (true) with check (true);

create policy "agencies_authenticated_all" on public.agencies
  for all to authenticated using (true) with check (true);

create policy "stores_authenticated_all" on public.stores
  for all to authenticated using (true) with check (true);

create policy "projects_authenticated_all" on public.projects
  for all to authenticated using (true) with check (true);

create policy "staff_authenticated_all" on public.staff
  for all to authenticated using (true) with check (true);

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

create policy "project_attachments_authenticated_all" on public.project_attachments
  for all to authenticated using (true) with check (true);

insert into public.carriers (code, name, sort_order) values
  ('docomo', 'NTTドコモ', 1),
  ('au', 'KDDI / au', 2),
  ('softbank', 'SoftBank', 3),
  ('rakuten', '楽天モバイル', 4)
on conflict (code) do nothing;

insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do nothing;

create policy "project_files_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'project-files');

create policy "project_files_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files');

create policy "project_files_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'project-files');

create policy "project_files_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'project-files');
