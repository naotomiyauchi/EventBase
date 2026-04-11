-- 合同会社 Anfra（当社）: 開発・マスタ・デフォルト環境のホスト
-- ElanBase 顧客向けは event-base.app / www のみ（20260411120000）

-- デフォルトテナントの表示名・ブランド（localhost / anfra 系で共通）
update public.tenants
set
  name = '合同会社Anfra',
  branding = jsonb_build_object(
    'productName', 'Anfra',
    'primaryHsl', '215 50% 42%'
  )
where slug = 'default';

-- 既存 DB で ElanBase にだけ紐いていたプレビュー URL を削除し、default へ付け替え
delete from public.tenant_domains
where hostname = 'event-base-chi.vercel.app';

insert into public.tenant_domains (tenant_id, hostname, is_primary)
select t.id, v.hostname, v.is_primary
from public.tenants t
cross join (
  values
    ('anfra.jp', true),
    ('www.anfra.jp', false),
    ('event-base-chi.vercel.app', false)
) as v(hostname, is_primary)
where t.slug = 'default'
on conflict (hostname) do update
set
  tenant_id = excluded.tenant_id,
  is_primary = excluded.is_primary;
