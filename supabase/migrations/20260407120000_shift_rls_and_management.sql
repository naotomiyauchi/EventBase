-- Phase 2 拡張: RLS 厳密化 + 希望休 + シフト確認

alter table public.project_shifts
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists staff_confirmed_at timestamptz;

create table if not exists public.staff_unavailable_dates (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  unavailable_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (staff_id, unavailable_date)
);

alter table public.staff_unavailable_dates enable row level security;

drop policy if exists "staff_unavailable_dates_authenticated_all" on public.staff_unavailable_dates;
create policy "staff_unavailable_dates_select" on public.staff_unavailable_dates
  for select to authenticated
  using (
    public.is_app_manager(auth.uid())
    or exists (
      select 1
      from public.staff s
      where s.id = staff_unavailable_dates.staff_id
        and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  );

create policy "staff_unavailable_dates_insert" on public.staff_unavailable_dates
  for insert to authenticated
  with check (
    public.is_app_manager(auth.uid())
    or exists (
      select 1
      from public.staff s
      where s.id = staff_unavailable_dates.staff_id
        and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  );

create policy "staff_unavailable_dates_update" on public.staff_unavailable_dates
  for update to authenticated
  using (
    public.is_app_manager(auth.uid())
    or exists (
      select 1
      from public.staff s
      where s.id = staff_unavailable_dates.staff_id
        and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  )
  with check (
    public.is_app_manager(auth.uid())
    or exists (
      select 1
      from public.staff s
      where s.id = staff_unavailable_dates.staff_id
        and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  );

create policy "staff_unavailable_dates_delete" on public.staff_unavailable_dates
  for delete to authenticated
  using (
    public.is_app_manager(auth.uid())
    or exists (
      select 1
      from public.staff s
      where s.id = staff_unavailable_dates.staff_id
        and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  );

create index if not exists staff_unavailable_dates_staff_date_idx
  on public.staff_unavailable_dates (staff_id, unavailable_date);

-- project_shifts / attendance / results / expenses の RLS を厳密化
drop policy if exists "project_shifts_authenticated_all" on public.project_shifts;
drop policy if exists "shift_attendance_authenticated_all" on public.shift_attendance;
drop policy if exists "shift_results_authenticated_all" on public.shift_results;
drop policy if exists "shift_expenses_authenticated_all" on public.shift_expenses;

create policy "project_shifts_select_access" on public.project_shifts
  for select to authenticated
  using (
    public.is_app_manager(auth.uid())
    or exists (
      select 1
      from public.staff s
      where s.id = project_shifts.staff_id
        and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  );

create policy "project_shifts_insert_manager" on public.project_shifts
  for insert to authenticated
  with check (public.is_app_manager(auth.uid()));

create policy "project_shifts_update_access" on public.project_shifts
  for update to authenticated
  using (
    public.is_app_manager(auth.uid())
    or exists (
      select 1
      from public.staff s
      where s.id = project_shifts.staff_id
        and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  )
  with check (
    public.is_app_manager(auth.uid())
    or exists (
      select 1
      from public.staff s
      where s.id = project_shifts.staff_id
        and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  );

create policy "project_shifts_delete_manager" on public.project_shifts
  for delete to authenticated
  using (public.is_app_manager(auth.uid()));

create policy "shift_attendance_select_access" on public.shift_attendance
  for select to authenticated
  using (
    public.is_app_manager(auth.uid())
    or exists (
      select 1
      from public.project_shifts ps
      join public.staff s on s.id = ps.staff_id
      where ps.id = shift_attendance.shift_id
        and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  );

create policy "shift_attendance_write_access" on public.shift_attendance
  for all to authenticated
  using (
    public.is_app_manager(auth.uid())
    or exists (
      select 1
      from public.project_shifts ps
      join public.staff s on s.id = ps.staff_id
      where ps.id = shift_attendance.shift_id
        and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  )
  with check (
    public.is_app_manager(auth.uid())
    or exists (
      select 1
      from public.project_shifts ps
      join public.staff s on s.id = ps.staff_id
      where ps.id = shift_attendance.shift_id
        and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  );

create policy "shift_results_access" on public.shift_results
  for all to authenticated
  using (
    public.is_app_manager(auth.uid())
    or exists (
      select 1
      from public.project_shifts ps
      join public.staff s on s.id = ps.staff_id
      where ps.id = shift_results.shift_id
        and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  )
  with check (
    public.is_app_manager(auth.uid())
    or exists (
      select 1
      from public.project_shifts ps
      join public.staff s on s.id = ps.staff_id
      where ps.id = shift_results.shift_id
        and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  );

create policy "shift_expenses_access" on public.shift_expenses
  for all to authenticated
  using (
    public.is_app_manager(auth.uid())
    or exists (
      select 1
      from public.project_shifts ps
      join public.staff s on s.id = ps.staff_id
      where ps.id = shift_expenses.shift_id
        and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  )
  with check (
    public.is_app_manager(auth.uid())
    or exists (
      select 1
      from public.project_shifts ps
      join public.staff s on s.id = ps.staff_id
      where ps.id = shift_expenses.shift_id
        and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  );
