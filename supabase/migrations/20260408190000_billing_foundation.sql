-- 請求/見積の土台（Phase 1）

create type public.billing_doc_kind as enum ('estimate', 'invoice');
create type public.billing_doc_status as enum (
  'draft',
  'issued',
  'sent',
  'overdue',
  'paid',
  'cancelled'
);

create table if not exists public.billing_documents (
  id uuid primary key default gen_random_uuid(),
  kind public.billing_doc_kind not null default 'invoice',
  status public.billing_doc_status not null default 'draft',
  doc_no text not null unique,
  agency_id uuid references public.agencies (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  period_start date,
  period_end date,
  issue_date date,
  due_date date,
  subtotal numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 10,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (subtotal >= 0),
  check (tax_rate >= 0),
  check (tax_amount >= 0),
  check (total_amount >= 0)
);

create table if not exists public.billing_document_lines (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.billing_documents (id) on delete cascade,
  sort_order int not null default 0,
  line_type text not null default 'custom',
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  project_id uuid references public.projects (id) on delete set null,
  shift_id uuid references public.project_shifts (id) on delete set null,
  created_at timestamptz not null default now(),
  check (quantity >= 0),
  check (unit_price >= 0),
  check (amount >= 0)
);

create index if not exists billing_documents_status_idx
  on public.billing_documents (status, issue_date desc);
create index if not exists billing_documents_agency_idx
  on public.billing_documents (agency_id, period_start, period_end);
create index if not exists billing_document_lines_document_idx
  on public.billing_document_lines (document_id, sort_order);

drop trigger if exists billing_documents_bump_updated_at on public.billing_documents;
create trigger billing_documents_bump_updated_at
  before update on public.billing_documents
  for each row execute function public.bump_updated_at();

alter table public.billing_documents enable row level security;
alter table public.billing_document_lines enable row level security;

create policy "billing_documents_select_access" on public.billing_documents
  for select to authenticated
  using (public.is_app_manager(auth.uid()));

create policy "billing_documents_write_access" on public.billing_documents
  for all to authenticated
  using (public.is_app_manager(auth.uid()))
  with check (public.is_app_manager(auth.uid()));

create policy "billing_document_lines_access" on public.billing_document_lines
  for all to authenticated
  using (public.is_app_manager(auth.uid()))
  with check (public.is_app_manager(auth.uid()));

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

