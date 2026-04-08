-- スタッフプロフィール拡張 + 職務経歴

alter table public.staff
  add column if not exists name_kana text,
  add column if not exists gender text,
  add column if not exists birth_date date,
  add column if not exists age_years int,
  add column if not exists address text,
  add column if not exists preferred_work_location text,
  add column if not exists nearest_station text,
  add column if not exists has_car boolean,
  add column if not exists commute_time_preference text,
  add column if not exists can_business_trip text,
  add column if not exists can_weekend_holiday text,
  add column if not exists preferred_shift_start text,
  add column if not exists pr_notes text;

update public.staff
set address = base_address
where address is null and base_address is not null;

create table public.staff_work_history (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  year int,
  month int,
  period_label text,
  job_content text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists staff_work_history_staff_id_idx on public.staff_work_history (staff_id);

alter table public.staff_work_history enable row level security;

create policy "staff_work_history_authenticated_all" on public.staff_work_history
  for all to authenticated using (true) with check (true);
