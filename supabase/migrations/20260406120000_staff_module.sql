-- スタッフ機能拡張: 拠点・更新日時・NG現場（出禁）

alter table public.staff
  add column if not exists base_address text,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.bump_staff_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists staff_bump_updated_at on public.staff;
create trigger staff_bump_updated_at
  before update on public.staff
  for each row
  execute function public.bump_staff_updated_at();

create table public.staff_ng_stores (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (staff_id, store_id)
);

alter table public.staff_ng_stores enable row level security;

create policy "staff_ng_stores_authenticated_all" on public.staff_ng_stores
  for all to authenticated using (true) with check (true);

create index if not exists staff_ng_stores_staff_id_idx on public.staff_ng_stores (staff_id);
create index if not exists staff_ng_stores_store_id_idx on public.staff_ng_stores (store_id);
