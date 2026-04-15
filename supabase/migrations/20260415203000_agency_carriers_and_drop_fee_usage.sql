-- agencies: allow multi-carrier mapping via junction table
-- keep agencies.carrier_id for backward compatibility / primary carrier

create table if not exists public.agency_carriers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  carrier_id uuid not null references public.carriers (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (agency_id, carrier_id)
);

create index if not exists agency_carriers_tenant_idx
  on public.agency_carriers (tenant_id);
create index if not exists agency_carriers_agency_idx
  on public.agency_carriers (agency_id);
create index if not exists agency_carriers_carrier_idx
  on public.agency_carriers (carrier_id);

insert into public.agency_carriers (tenant_id, agency_id, carrier_id)
select a.tenant_id, a.id, a.carrier_id
from public.agencies a
where a.carrier_id is not null
on conflict (agency_id, carrier_id) do nothing;

create or replace function public.fill_agency_carriers_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tenant_id is null then
    select a.tenant_id into new.tenant_id
    from public.agencies a
    where a.id = new.agency_id;
  end if;
  if new.tenant_id is null then
    raise exception 'tenant_id could not be resolved for agency_carriers';
  end if;
  return new;
end;
$$;

drop trigger if exists agency_carriers_fill_tenant on public.agency_carriers;
create trigger agency_carriers_fill_tenant
  before insert or update on public.agency_carriers
  for each row execute function public.fill_agency_carriers_tenant();

alter table public.agency_carriers enable row level security;

drop policy if exists "agency_carriers_tenant_access" on public.agency_carriers;
create policy "agency_carriers_tenant_access" on public.agency_carriers
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
