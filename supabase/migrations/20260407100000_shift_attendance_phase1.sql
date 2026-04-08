-- シフト管理 / 勤怠実績 / 本日稼働ダッシュボード向けの土台（Phase 1）

create type public.shift_role as enum ('leader', 'helper');
create type public.shift_status as enum ('assigned', 'confirmed', 'cancelled');
create type public.attendance_status as enum ('not_started', 'working', 'reported');
create type public.expense_type as enum ('transport', 'parking', 'supplies', 'other');

alter table public.projects
  add column if not exists required_headcount int not null default 0,
  add column if not exists unit_price numeric(12,2) not null default 0,
  add column if not exists site_address text,
  add column if not exists site_lat numeric(10,7),
  add column if not exists site_lng numeric(10,7),
  add column if not exists leader_staff_id uuid references public.staff (id) on delete set null;

alter table public.staff
  add column if not exists hourly_cost numeric(10,2) not null default 0;

create table public.project_shifts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  scheduled_start_at timestamptz not null,
  scheduled_end_at timestamptz not null,
  role public.shift_role not null default 'helper',
  status public.shift_status not null default 'assigned',
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end_at > scheduled_start_at)
);

create table public.shift_attendance (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null unique references public.project_shifts (id) on delete cascade,
  checkin_at timestamptz,
  checkout_at timestamptz,
  checkin_lat numeric(10,7),
  checkin_lng numeric(10,7),
  checkout_lat numeric(10,7),
  checkout_lng numeric(10,7),
  status public.attendance_status not null default 'not_started',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (checkout_at is null or checkin_at is null or checkout_at >= checkin_at)
);

create table public.shift_results (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null unique references public.project_shifts (id) on delete cascade,
  mnp_count int not null default 0,
  new_count int not null default 0,
  option_count int not null default 0,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shift_expenses (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.project_shifts (id) on delete cascade,
  expense_type public.expense_type not null default 'other',
  amount numeric(10,2) not null default 0,
  receipt_url text,
  note text,
  created_at timestamptz not null default now(),
  check (amount >= 0)
);

create or replace function public.bump_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists project_shifts_bump_updated_at on public.project_shifts;
create trigger project_shifts_bump_updated_at
  before update on public.project_shifts
  for each row
  execute function public.bump_updated_at();

drop trigger if exists shift_attendance_bump_updated_at on public.shift_attendance;
create trigger shift_attendance_bump_updated_at
  before update on public.shift_attendance
  for each row
  execute function public.bump_updated_at();

drop trigger if exists shift_results_bump_updated_at on public.shift_results;
create trigger shift_results_bump_updated_at
  before update on public.shift_results
  for each row
  execute function public.bump_updated_at();

create index if not exists project_shifts_project_id_idx on public.project_shifts (project_id);
create index if not exists project_shifts_staff_id_idx on public.project_shifts (staff_id);
create index if not exists project_shifts_scheduled_start_at_idx on public.project_shifts (scheduled_start_at);
create index if not exists shift_expenses_shift_id_idx on public.shift_expenses (shift_id);

alter table public.project_shifts enable row level security;
alter table public.shift_attendance enable row level security;
alter table public.shift_results enable row level security;
alter table public.shift_expenses enable row level security;

create policy "project_shifts_authenticated_all" on public.project_shifts
  for all to authenticated using (true) with check (true);

create policy "shift_attendance_authenticated_all" on public.shift_attendance
  for all to authenticated using (true) with check (true);

create policy "shift_results_authenticated_all" on public.shift_results
  for all to authenticated using (true) with check (true);

create policy "shift_expenses_authenticated_all" on public.shift_expenses
  for all to authenticated using (true) with check (true);
