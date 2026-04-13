-- Phase 1: 企業間データ分離を tenant_id ベースで強制
-- Phase 2: 代理店別手数料率の基盤

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.tenant_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

grant execute on function public.current_tenant_id() to authenticated;

alter table public.agencies
  add column if not exists fee_rate numeric(5,2) not null default 0;
alter table public.agencies
  drop constraint if exists agencies_fee_rate_nonnegative;
alter table public.agencies
  add constraint agencies_fee_rate_nonnegative check (fee_rate >= 0);

alter table public.stores
  add column if not exists tenant_id uuid references public.tenants (id);
alter table public.projects
  add column if not exists tenant_id uuid references public.tenants (id);
alter table public.project_shifts
  add column if not exists tenant_id uuid references public.tenants (id);
alter table public.shift_attendance
  add column if not exists tenant_id uuid references public.tenants (id);
alter table public.shift_results
  add column if not exists tenant_id uuid references public.tenants (id);
alter table public.shift_expenses
  add column if not exists tenant_id uuid references public.tenants (id);
alter table public.staff_unavailable_dates
  add column if not exists tenant_id uuid references public.tenants (id);
alter table public.staff_ng_stores
  add column if not exists tenant_id uuid references public.tenants (id);
alter table public.staff_work_history
  add column if not exists tenant_id uuid references public.tenants (id);
alter table public.billing_documents
  add column if not exists tenant_id uuid references public.tenants (id);
alter table public.billing_document_lines
  add column if not exists tenant_id uuid references public.tenants (id);
alter table public.billing_send_logs
  add column if not exists tenant_id uuid references public.tenants (id);

update public.stores s
set tenant_id = a.tenant_id
from public.agencies a
where s.agency_id = a.id
  and s.tenant_id is null;

update public.projects p
set tenant_id = s.tenant_id
from public.stores s
where p.store_id = s.id
  and p.tenant_id is null;

update public.project_shifts ps
set tenant_id = p.tenant_id
from public.projects p
where ps.project_id = p.id
  and ps.tenant_id is null;

update public.shift_attendance sa
set tenant_id = ps.tenant_id
from public.project_shifts ps
where sa.shift_id = ps.id
  and sa.tenant_id is null;

update public.shift_results sr
set tenant_id = ps.tenant_id
from public.project_shifts ps
where sr.shift_id = ps.id
  and sr.tenant_id is null;

update public.shift_expenses se
set tenant_id = ps.tenant_id
from public.project_shifts ps
where se.shift_id = ps.id
  and se.tenant_id is null;

update public.staff_unavailable_dates sud
set tenant_id = s.tenant_id
from public.staff s
where sud.staff_id = s.id
  and sud.tenant_id is null;

update public.staff_ng_stores sns
set tenant_id = s.tenant_id
from public.staff s
where sns.staff_id = s.id
  and sns.tenant_id is null;

update public.staff_work_history swh
set tenant_id = s.tenant_id
from public.staff s
where swh.staff_id = s.id
  and swh.tenant_id is null;

update public.billing_documents bd
set tenant_id = a.tenant_id
from public.agencies a
where bd.agency_id = a.id
  and bd.tenant_id is null;

update public.billing_documents bd
set tenant_id = p.tenant_id
from public.projects p
where bd.project_id = p.id
  and bd.tenant_id is null;

update public.billing_documents bd
set tenant_id = cp.tenant_id
from public.profiles cp
where bd.created_by = cp.id
  and bd.tenant_id is null;

update public.billing_documents bd
set tenant_id = (select id from public.tenants where slug = 'default' limit 1)
where bd.tenant_id is null;

update public.billing_document_lines bdl
set tenant_id = bd.tenant_id
from public.billing_documents bd
where bdl.document_id = bd.id
  and bdl.tenant_id is null;

update public.billing_send_logs bsl
set tenant_id = bd.tenant_id
from public.billing_documents bd
where bsl.document_id = bd.id
  and bsl.tenant_id is null;

alter table public.stores alter column tenant_id set not null;
alter table public.projects alter column tenant_id set not null;
alter table public.project_shifts alter column tenant_id set not null;
alter table public.shift_attendance alter column tenant_id set not null;
alter table public.shift_results alter column tenant_id set not null;
alter table public.shift_expenses alter column tenant_id set not null;
alter table public.staff_unavailable_dates alter column tenant_id set not null;
alter table public.staff_ng_stores alter column tenant_id set not null;
alter table public.staff_work_history alter column tenant_id set not null;
alter table public.billing_documents alter column tenant_id set not null;
alter table public.billing_document_lines alter column tenant_id set not null;
alter table public.billing_send_logs alter column tenant_id set not null;

create or replace function public.fill_tenant_from_relations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'stores' then
    if new.tenant_id is null then
      select a.tenant_id into new.tenant_id from public.agencies a where a.id = new.agency_id;
    end if;
  elsif tg_table_name = 'projects' then
    if new.tenant_id is null then
      select s.tenant_id into new.tenant_id from public.stores s where s.id = new.store_id;
    end if;
  elsif tg_table_name = 'project_shifts' then
    if new.tenant_id is null then
      select p.tenant_id into new.tenant_id from public.projects p where p.id = new.project_id;
    end if;
  elsif tg_table_name = 'shift_attendance' then
    if new.tenant_id is null then
      select ps.tenant_id into new.tenant_id from public.project_shifts ps where ps.id = new.shift_id;
    end if;
  elsif tg_table_name = 'shift_results' then
    if new.tenant_id is null then
      select ps.tenant_id into new.tenant_id from public.project_shifts ps where ps.id = new.shift_id;
    end if;
  elsif tg_table_name = 'shift_expenses' then
    if new.tenant_id is null then
      select ps.tenant_id into new.tenant_id from public.project_shifts ps where ps.id = new.shift_id;
    end if;
  elsif tg_table_name = 'staff_unavailable_dates' then
    if new.tenant_id is null then
      select s.tenant_id into new.tenant_id from public.staff s where s.id = new.staff_id;
    end if;
  elsif tg_table_name = 'staff_ng_stores' then
    if new.tenant_id is null then
      select s.tenant_id into new.tenant_id from public.staff s where s.id = new.staff_id;
    end if;
  elsif tg_table_name = 'staff_work_history' then
    if new.tenant_id is null then
      select s.tenant_id into new.tenant_id from public.staff s where s.id = new.staff_id;
    end if;
  elsif tg_table_name = 'billing_documents' then
    if new.tenant_id is null then
      if new.agency_id is not null then
        select a.tenant_id into new.tenant_id from public.agencies a where a.id = new.agency_id;
      elsif new.project_id is not null then
        select p.tenant_id into new.tenant_id from public.projects p where p.id = new.project_id;
      elsif new.created_by is not null then
        select p.tenant_id into new.tenant_id from public.profiles p where p.id = new.created_by;
      else
        new.tenant_id := public.current_tenant_id();
      end if;
    end if;
  elsif tg_table_name = 'billing_document_lines' then
    if new.tenant_id is null then
      select bd.tenant_id into new.tenant_id from public.billing_documents bd where bd.id = new.document_id;
    end if;
  elsif tg_table_name = 'billing_send_logs' then
    if new.tenant_id is null then
      select bd.tenant_id into new.tenant_id from public.billing_documents bd where bd.id = new.document_id;
    end if;
  end if;

  if new.tenant_id is null then
    raise exception 'tenant_id could not be resolved for table %', tg_table_name;
  end if;
  return new;
end;
$$;

drop trigger if exists stores_fill_tenant on public.stores;
create trigger stores_fill_tenant
  before insert or update on public.stores
  for each row execute function public.fill_tenant_from_relations();

drop trigger if exists projects_fill_tenant on public.projects;
create trigger projects_fill_tenant
  before insert or update on public.projects
  for each row execute function public.fill_tenant_from_relations();

drop trigger if exists project_shifts_fill_tenant on public.project_shifts;
create trigger project_shifts_fill_tenant
  before insert or update on public.project_shifts
  for each row execute function public.fill_tenant_from_relations();

drop trigger if exists shift_attendance_fill_tenant on public.shift_attendance;
create trigger shift_attendance_fill_tenant
  before insert or update on public.shift_attendance
  for each row execute function public.fill_tenant_from_relations();

drop trigger if exists shift_results_fill_tenant on public.shift_results;
create trigger shift_results_fill_tenant
  before insert or update on public.shift_results
  for each row execute function public.fill_tenant_from_relations();

drop trigger if exists shift_expenses_fill_tenant on public.shift_expenses;
create trigger shift_expenses_fill_tenant
  before insert or update on public.shift_expenses
  for each row execute function public.fill_tenant_from_relations();

drop trigger if exists staff_unavailable_dates_fill_tenant on public.staff_unavailable_dates;
create trigger staff_unavailable_dates_fill_tenant
  before insert or update on public.staff_unavailable_dates
  for each row execute function public.fill_tenant_from_relations();

drop trigger if exists staff_ng_stores_fill_tenant on public.staff_ng_stores;
create trigger staff_ng_stores_fill_tenant
  before insert or update on public.staff_ng_stores
  for each row execute function public.fill_tenant_from_relations();

drop trigger if exists staff_work_history_fill_tenant on public.staff_work_history;
create trigger staff_work_history_fill_tenant
  before insert or update on public.staff_work_history
  for each row execute function public.fill_tenant_from_relations();

drop trigger if exists billing_documents_fill_tenant on public.billing_documents;
create trigger billing_documents_fill_tenant
  before insert or update on public.billing_documents
  for each row execute function public.fill_tenant_from_relations();

drop trigger if exists billing_document_lines_fill_tenant on public.billing_document_lines;
create trigger billing_document_lines_fill_tenant
  before insert or update on public.billing_document_lines
  for each row execute function public.fill_tenant_from_relations();

drop trigger if exists billing_send_logs_fill_tenant on public.billing_send_logs;
create trigger billing_send_logs_fill_tenant
  before insert or update on public.billing_send_logs
  for each row execute function public.fill_tenant_from_relations();

drop policy if exists "agencies_authenticated_all" on public.agencies;
drop policy if exists "stores_authenticated_all" on public.stores;
drop policy if exists "projects_authenticated_all" on public.projects;
drop policy if exists "staff_authenticated_all" on public.staff;
drop policy if exists "staff_work_history_authenticated_all" on public.staff_work_history;
drop policy if exists "staff_ng_stores_authenticated_all" on public.staff_ng_stores;

create policy "agencies_tenant_access" on public.agencies
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "stores_tenant_access" on public.stores
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "projects_tenant_access" on public.projects
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "staff_tenant_access" on public.staff
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "staff_work_history_tenant_access" on public.staff_work_history
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "staff_ng_stores_tenant_access" on public.staff_ng_stores
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

drop policy if exists "staff_unavailable_dates_select" on public.staff_unavailable_dates;
drop policy if exists "staff_unavailable_dates_insert" on public.staff_unavailable_dates;
drop policy if exists "staff_unavailable_dates_update" on public.staff_unavailable_dates;
drop policy if exists "staff_unavailable_dates_delete" on public.staff_unavailable_dates;

create policy "staff_unavailable_dates_select" on public.staff_unavailable_dates
  for select to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (
      public.is_app_manager(auth.uid())
      or exists (
        select 1
        from public.staff s
        where s.id = staff_unavailable_dates.staff_id
          and s.tenant_id = public.current_tenant_id()
          and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
      )
    )
  );

create policy "staff_unavailable_dates_insert" on public.staff_unavailable_dates
  for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and (
      public.is_app_manager(auth.uid())
      or exists (
        select 1
        from public.staff s
        where s.id = staff_unavailable_dates.staff_id
          and s.tenant_id = public.current_tenant_id()
          and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
      )
    )
  );

create policy "staff_unavailable_dates_update" on public.staff_unavailable_dates
  for update to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (
      public.is_app_manager(auth.uid())
      or exists (
        select 1
        from public.staff s
        where s.id = staff_unavailable_dates.staff_id
          and s.tenant_id = public.current_tenant_id()
          and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
      )
    )
  )
  with check (
    tenant_id = public.current_tenant_id()
    and (
      public.is_app_manager(auth.uid())
      or exists (
        select 1
        from public.staff s
        where s.id = staff_unavailable_dates.staff_id
          and s.tenant_id = public.current_tenant_id()
          and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
      )
    )
  );

create policy "staff_unavailable_dates_delete" on public.staff_unavailable_dates
  for delete to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (
      public.is_app_manager(auth.uid())
      or exists (
        select 1
        from public.staff s
        where s.id = staff_unavailable_dates.staff_id
          and s.tenant_id = public.current_tenant_id()
          and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
      )
    )
  );

drop policy if exists "project_shifts_select_access" on public.project_shifts;
drop policy if exists "project_shifts_insert_manager" on public.project_shifts;
drop policy if exists "project_shifts_update_access" on public.project_shifts;
drop policy if exists "project_shifts_delete_manager" on public.project_shifts;
drop policy if exists "shift_attendance_select_access" on public.shift_attendance;
drop policy if exists "shift_attendance_write_access" on public.shift_attendance;
drop policy if exists "shift_results_access" on public.shift_results;
drop policy if exists "shift_expenses_access" on public.shift_expenses;

create policy "project_shifts_select_access" on public.project_shifts
  for select to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (
      public.is_app_manager(auth.uid())
      or exists (
        select 1
        from public.staff s
        where s.id = project_shifts.staff_id
          and s.tenant_id = public.current_tenant_id()
          and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
      )
    )
  );

create policy "project_shifts_insert_manager" on public.project_shifts
  for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  );

create policy "project_shifts_update_access" on public.project_shifts
  for update to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (
      public.is_app_manager(auth.uid())
      or exists (
        select 1
        from public.staff s
        where s.id = project_shifts.staff_id
          and s.tenant_id = public.current_tenant_id()
          and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
      )
    )
  )
  with check (
    tenant_id = public.current_tenant_id()
    and (
      public.is_app_manager(auth.uid())
      or exists (
        select 1
        from public.staff s
        where s.id = project_shifts.staff_id
          and s.tenant_id = public.current_tenant_id()
          and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
      )
    )
  );

create policy "project_shifts_delete_manager" on public.project_shifts
  for delete to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  );

create policy "shift_attendance_select_access" on public.shift_attendance
  for select to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (
      public.is_app_manager(auth.uid())
      or exists (
        select 1
        from public.project_shifts ps
        join public.staff s on s.id = ps.staff_id
        where ps.id = shift_attendance.shift_id
          and ps.tenant_id = public.current_tenant_id()
          and s.tenant_id = public.current_tenant_id()
          and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
      )
    )
  );

create policy "shift_attendance_write_access" on public.shift_attendance
  for all to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (
      public.is_app_manager(auth.uid())
      or exists (
        select 1
        from public.project_shifts ps
        join public.staff s on s.id = ps.staff_id
        where ps.id = shift_attendance.shift_id
          and ps.tenant_id = public.current_tenant_id()
          and s.tenant_id = public.current_tenant_id()
          and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
      )
    )
  )
  with check (
    tenant_id = public.current_tenant_id()
    and (
      public.is_app_manager(auth.uid())
      or exists (
        select 1
        from public.project_shifts ps
        join public.staff s on s.id = ps.staff_id
        where ps.id = shift_attendance.shift_id
          and ps.tenant_id = public.current_tenant_id()
          and s.tenant_id = public.current_tenant_id()
          and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
      )
    )
  );

create policy "shift_results_access" on public.shift_results
  for all to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (
      public.is_app_manager(auth.uid())
      or exists (
        select 1
        from public.project_shifts ps
        join public.staff s on s.id = ps.staff_id
        where ps.id = shift_results.shift_id
          and ps.tenant_id = public.current_tenant_id()
          and s.tenant_id = public.current_tenant_id()
          and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
      )
    )
  )
  with check (
    tenant_id = public.current_tenant_id()
    and (
      public.is_app_manager(auth.uid())
      or exists (
        select 1
        from public.project_shifts ps
        join public.staff s on s.id = ps.staff_id
        where ps.id = shift_results.shift_id
          and ps.tenant_id = public.current_tenant_id()
          and s.tenant_id = public.current_tenant_id()
          and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
      )
    )
  );

create policy "shift_expenses_access" on public.shift_expenses
  for all to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (
      public.is_app_manager(auth.uid())
      or exists (
        select 1
        from public.project_shifts ps
        join public.staff s on s.id = ps.staff_id
        where ps.id = shift_expenses.shift_id
          and ps.tenant_id = public.current_tenant_id()
          and s.tenant_id = public.current_tenant_id()
          and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
      )
    )
  )
  with check (
    tenant_id = public.current_tenant_id()
    and (
      public.is_app_manager(auth.uid())
      or exists (
        select 1
        from public.project_shifts ps
        join public.staff s on s.id = ps.staff_id
        where ps.id = shift_expenses.shift_id
          and ps.tenant_id = public.current_tenant_id()
          and s.tenant_id = public.current_tenant_id()
          and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
      )
    )
  );

drop policy if exists "billing_documents_select_access" on public.billing_documents;
drop policy if exists "billing_documents_write_access" on public.billing_documents;
drop policy if exists "billing_document_lines_access" on public.billing_document_lines;
drop policy if exists "billing_send_logs_access" on public.billing_send_logs;

create policy "billing_documents_select_access" on public.billing_documents
  for select to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  );

create policy "billing_documents_write_access" on public.billing_documents
  for all to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  );

create policy "billing_document_lines_access" on public.billing_document_lines
  for all to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  );

create policy "billing_send_logs_access" on public.billing_send_logs
  for all to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  );

create or replace function public.generate_project_billing_rows(p_project_id uuid)
returns table (
  project_id uuid,
  project_title text,
  shift_count int,
  unit_price numeric,
  expense_total numeric,
  agency_id uuid
)
language sql
security definer
set search_path = public
as $$
  with s as (
    select
      ps.id as shift_id,
      ps.project_id,
      p.title as project_title,
      coalesce(p.unit_price, 0) as unit_price,
      st.agency_id
    from public.project_shifts ps
    join public.projects p on p.id = ps.project_id
    join public.stores st on st.id = p.store_id
    left join public.shift_attendance sa on sa.shift_id = ps.id
    where ps.project_id = p_project_id
      and ps.status <> 'cancelled'
      and sa.checkout_at is not null
      and st.tenant_id = public.current_tenant_id()
  ),
  e as (
    select se.shift_id, sum(coalesce(se.amount, 0)) as expense_total
    from public.shift_expenses se
    group by se.shift_id
  )
  select
    s.project_id,
    max(s.project_title) as project_title,
    count(*)::int as shift_count,
    max(s.unit_price) as unit_price,
    coalesce(sum(coalesce(e.expense_total, 0)), 0)::numeric as expense_total,
    (array_agg(s.agency_id))[1] as agency_id
  from s
  left join e on e.shift_id = s.shift_id
  group by s.project_id;
$$;

create or replace function public.generate_agency_month_billing_rows(
  p_agency_id uuid,
  p_start date,
  p_end date
)
returns table (
  project_id uuid,
  project_title text,
  shift_count int,
  unit_price numeric,
  expense_total numeric,
  agency_id uuid
)
language sql
security definer
set search_path = public
as $$
  with s as (
    select
      ps.id as shift_id,
      ps.project_id,
      p.title as project_title,
      coalesce(p.unit_price, 0) as unit_price,
      st.agency_id
    from public.project_shifts ps
    join public.projects p on p.id = ps.project_id
    join public.stores st on st.id = p.store_id
    left join public.shift_attendance sa on sa.shift_id = ps.id
    where st.agency_id = p_agency_id
      and ps.status <> 'cancelled'
      and sa.checkout_at is not null
      and ps.shift_date >= p_start
      and ps.shift_date < p_end
      and st.tenant_id = public.current_tenant_id()
  ),
  e as (
    select se.shift_id, sum(coalesce(se.amount, 0)) as expense_total
    from public.shift_expenses se
    group by se.shift_id
  )
  select
    s.project_id,
    max(s.project_title) as project_title,
    count(*)::int as shift_count,
    max(s.unit_price) as unit_price,
    coalesce(sum(coalesce(e.expense_total, 0)), 0)::numeric as expense_total,
    (array_agg(s.agency_id))[1] as agency_id
  from s
  left join e on e.shift_id = s.shift_id
  group by s.project_id;
$$;
