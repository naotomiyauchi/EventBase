-- 領収書ボックス + 現金出納帳（会計補助）

create type public.receipt_payment_method as enum ('cash', 'bank', 'card', 'other');
create type public.cashbook_entry_type as enum ('income', 'expense', 'adjustment');

create table if not exists public.finance_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  agency_id uuid references public.agencies (id) on delete set null,
  shift_id uuid references public.project_shifts (id) on delete set null,
  expense_date date not null default current_date,
  vendor text,
  category text not null default 'other',
  payment_method public.receipt_payment_method not null default 'cash',
  amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  memo text,
  file_path text not null,
  created_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount >= 0),
  check (tax_amount >= 0)
);

create table if not exists public.finance_cashbook_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  receipt_id uuid unique references public.finance_receipts (id) on delete cascade,
  entry_date date not null default current_date,
  entry_type public.cashbook_entry_type not null default 'expense',
  account text not null default 'cash',
  category text,
  description text,
  amount numeric(12,2) not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (amount >= 0)
);

create index if not exists finance_receipts_tenant_date_idx
  on public.finance_receipts (tenant_id, expense_date desc);
create index if not exists finance_cashbook_tenant_date_idx
  on public.finance_cashbook_entries (tenant_id, entry_date desc);

drop trigger if exists finance_receipts_bump_updated_at on public.finance_receipts;
create trigger finance_receipts_bump_updated_at
  before update on public.finance_receipts
  for each row execute function public.bump_updated_at();

create or replace function public.fill_finance_receipt_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tenant_id is null then
    if new.project_id is not null then
      select p.tenant_id into new.tenant_id from public.projects p where p.id = new.project_id;
    elsif new.agency_id is not null then
      select a.tenant_id into new.tenant_id from public.agencies a where a.id = new.agency_id;
    elsif new.shift_id is not null then
      select ps.tenant_id into new.tenant_id from public.project_shifts ps where ps.id = new.shift_id;
    else
      new.tenant_id := public.current_tenant_id();
    end if;
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists finance_receipts_fill_tenant on public.finance_receipts;
create trigger finance_receipts_fill_tenant
  before insert or update on public.finance_receipts
  for each row execute function public.fill_finance_receipt_tenant();

create or replace function public.sync_cashbook_from_receipt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.finance_cashbook_entries (
    tenant_id,
    receipt_id,
    entry_date,
    entry_type,
    account,
    category,
    description,
    amount,
    created_by
  ) values (
    new.tenant_id,
    new.id,
    new.expense_date,
    'expense'::public.cashbook_entry_type,
    case new.payment_method
      when 'cash'::public.receipt_payment_method then 'cash'
      when 'bank'::public.receipt_payment_method then 'bank'
      when 'card'::public.receipt_payment_method then 'card'
      else 'other'
    end,
    new.category,
    coalesce(new.vendor, '領収書') || coalesce(' / ' || nullif(new.memo, ''), ''),
    new.amount,
    coalesce(new.created_by, auth.uid())
  )
  on conflict (receipt_id) do update
  set
    tenant_id = excluded.tenant_id,
    entry_date = excluded.entry_date,
    account = excluded.account,
    category = excluded.category,
    description = excluded.description,
    amount = excluded.amount;
  return new;
end;
$$;

drop trigger if exists finance_receipts_sync_cashbook on public.finance_receipts;
create trigger finance_receipts_sync_cashbook
  after insert or update on public.finance_receipts
  for each row execute function public.sync_cashbook_from_receipt();

alter table public.finance_receipts enable row level security;
alter table public.finance_cashbook_entries enable row level security;

create policy "finance_receipts_access" on public.finance_receipts
  for all to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  );

create policy "finance_cashbook_access" on public.finance_cashbook_entries
  for all to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  );

insert into storage.buckets (id, name, public)
values ('receipt-files', 'receipt-files', false)
on conflict (id) do nothing;

drop policy if exists "receipt_files_select" on storage.objects;
create policy "receipt_files_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'receipt-files'
    and public.is_app_manager(auth.uid())
  );

drop policy if exists "receipt_files_insert" on storage.objects;
create policy "receipt_files_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipt-files'
    and public.is_app_manager(auth.uid())
  );

drop policy if exists "receipt_files_update" on storage.objects;
create policy "receipt_files_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'receipt-files'
    and public.is_app_manager(auth.uid())
  );

drop policy if exists "receipt_files_delete" on storage.objects;
create policy "receipt_files_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipt-files'
    and public.is_app_manager(auth.uid())
  );
