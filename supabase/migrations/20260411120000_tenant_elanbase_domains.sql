-- ElanBase（顧客）: event-base.app / www のみ。このファイルより後のマイグレーションで当社ドメインを default に紐づける。

insert into public.tenants (name, slug, branding)
values (
  'ElanBase',
  'elanbase',
  jsonb_build_object(
    'productName', 'ElanBase',
    'primaryHsl', '230 52% 42%'
  )
)
on conflict (slug) do update
set
  name = excluded.name,
  branding = excluded.branding;

insert into public.tenant_domains (tenant_id, hostname, is_primary)
select t.id, v.hostname, v.is_primary
from public.tenants t
cross join (
  values
    ('event-base.app', true),
    ('www.event-base.app', false)
) as v(hostname, is_primary)
where t.slug = 'elanbase'
on conflict (hostname) do update
set
  tenant_id = excluded.tenant_id,
  is_primary = excluded.is_primary;
