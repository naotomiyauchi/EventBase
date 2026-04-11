-- マルチテナント基盤（論理分割・白ラベル）
-- 既存の広い RLS は維持。tenant_id で将来の行レベル分離に備える。

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  branding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  hostname text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (hostname)
);

create index if not exists tenant_domains_tenant_id_idx
  on public.tenant_domains (tenant_id);

-- 機能フラグ（テナントごとに UI / 機能のオンオフ）
create table public.tenant_feature_flags (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  flag_key text not null,
  value jsonb not null default 'true'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, flag_key)
);

-- プラグイン／独自ロジック用の設定（計算モジュールのパラメータ等。実行はアプリ側）
create table public.tenant_plugin_configs (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  module_key text not null,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, module_key)
);

-- スキーマ・コンフィギュレーション（実績項目などを管理者定義で拡張するための定義）
create table public.tenant_custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  entity text not null,
  field_key text not null,
  label text not null,
  data_type text not null default 'text',
  sort_order int not null default 0,
  options jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, entity, field_key)
);

create index if not exists tenant_custom_field_definitions_lookup_idx
  on public.tenant_custom_field_definitions (tenant_id, entity, sort_order);

-- デフォルトテナント（既存データはすべてここに紐づく）
insert into public.tenants (name, slug, branding)
values (
  'EventBase',
  'default',
  '{}'::jsonb
);

-- ローカル開発用ホスト（本番では管理画面または SQL でドメインを追加）
insert into public.tenant_domains (tenant_id, hostname, is_primary)
select id, 'localhost', true
from public.tenants
where slug = 'default'
on conflict (hostname) do nothing;

insert into public.tenant_domains (tenant_id, hostname, is_primary)
select id, '127.0.0.1', false
from public.tenants
where slug = 'default'
on conflict (hostname) do nothing;

alter table public.agencies
  add column if not exists tenant_id uuid references public.tenants (id);

alter table public.profiles
  add column if not exists tenant_id uuid references public.tenants (id);

alter table public.staff
  add column if not exists tenant_id uuid references public.tenants (id);

update public.agencies a
set tenant_id = (select id from public.tenants where slug = 'default' limit 1)
where a.tenant_id is null;

update public.profiles p
set tenant_id = (select id from public.tenants where slug = 'default' limit 1)
where p.tenant_id is null;

update public.staff s
set tenant_id = (select id from public.tenants where slug = 'default' limit 1)
where s.tenant_id is null;

alter table public.agencies
  alter column tenant_id set not null;

alter table public.profiles
  alter column tenant_id set not null;

alter table public.staff
  alter column tenant_id set not null;

-- 新規ユーザーにデフォルトテナントを付与
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.app_role;
  existing_count int;
  tid uuid;
begin
  select id into tid from public.tenants where slug = 'default' limit 1;
  if tid is null then
    raise exception 'default tenant missing';
  end if;

  select count(*)::int into existing_count from public.profiles;

  if existing_count = 0 then
    r := 'admin'::public.app_role;
    begin
      if new.raw_user_meta_data is not null
         and nullif(trim(new.raw_user_meta_data->>'app_role'), '') is not null
      then
        r := trim(new.raw_user_meta_data->>'app_role')::public.app_role;
      end if;
    exception
      when others then
        r := 'admin'::public.app_role;
    end;
  else
    r := 'staff'::public.app_role;
    begin
      if new.raw_user_meta_data is not null
         and nullif(trim(new.raw_user_meta_data->>'app_role'), '') is not null
      then
        r := trim(new.raw_user_meta_data->>'app_role')::public.app_role;
      end if;
    exception
      when others then
        r := 'staff'::public.app_role;
    end;
  end if;

  insert into public.profiles (id, display_name, role, tenant_id)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    ),
    r,
    tid
  );
  return new;
end;
$$;

-- Host ヘッダからテナント解決（ログイン画面のブランディング用。anon 可）
create or replace function public.resolve_tenant_by_hostname(p_hostname text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_host text;
  r record;
  tid uuid;
begin
  v_host := lower(trim(p_hostname));
  v_host := split_part(v_host, ':', 1);

  select t.id, t.name, t.slug, t.branding
  into r
  from public.tenant_domains d
  join public.tenants t on t.id = d.tenant_id
  where lower(d.hostname) = v_host
  limit 1;

  if found then
    return jsonb_build_object(
      'id', r.id,
      'name', r.name,
      'slug', r.slug,
      'branding', coalesce(r.branding, '{}'::jsonb)
    );
  end if;

  select id into tid from public.tenants where slug = 'default' limit 1;
  select t.id, t.name, t.slug, t.branding
  into r
  from public.tenants t
  where t.id = tid
  limit 1;

  if not found then
    return jsonb_build_object(
      'id', null,
      'name', null,
      'slug', null,
      'branding', '{}'::jsonb
    );
  end if;

  return jsonb_build_object(
    'id', r.id,
    'name', r.name,
    'slug', r.slug,
    'branding', coalesce(r.branding, '{}'::jsonb)
  );
end;
$$;

grant execute on function public.resolve_tenant_by_hostname(text) to anon, authenticated;

-- ダッシュボードでテナント情報取得（同一テナントのみ）
create or replace function public.get_tenant_branding_public(p_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'slug', t.slug,
    'branding', coalesce(t.branding, '{}'::jsonb)
  )
  from public.tenants t
  where t.id = p_tenant_id;
$$;

grant execute on function public.get_tenant_branding_public(uuid) to authenticated;

alter table public.tenants enable row level security;
alter table public.tenant_domains enable row level security;
alter table public.tenant_feature_flags enable row level security;
alter table public.tenant_plugin_configs enable row level security;
alter table public.tenant_custom_field_definitions enable row level security;

create policy "tenants_select_same_tenant"
  on public.tenants
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.tenant_id = tenants.id
    )
  );

-- 管理者はマスタ参照でテナント横断が必要な場合に備え、管理者のみ全件 select（既存の運用に合わせる）
create policy "tenants_select_admin"
  on public.tenants
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

create policy "tenant_domains_select_access"
  on public.tenant_domains
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.tenant_id = tenant_domains.tenant_id
    )
    or public.is_admin(auth.uid())
  );

create policy "tenant_domains_write_admin"
  on public.tenant_domains
  for all
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "tenant_feature_flags_access"
  on public.tenant_feature_flags
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.tenant_id = tenant_feature_flags.tenant_id
    )
    and public.is_app_manager(auth.uid())
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.tenant_id = tenant_feature_flags.tenant_id
    )
    and public.is_app_manager(auth.uid())
  );

create policy "tenant_plugin_configs_access"
  on public.tenant_plugin_configs
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.tenant_id = tenant_plugin_configs.tenant_id
    )
    and public.is_app_manager(auth.uid())
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.tenant_id = tenant_plugin_configs.tenant_id
    )
    and public.is_app_manager(auth.uid())
  );

create policy "tenant_custom_field_definitions_access"
  on public.tenant_custom_field_definitions
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.tenant_id = tenant_custom_field_definitions.tenant_id
    )
    and public.is_app_manager(auth.uid())
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.tenant_id = tenant_custom_field_definitions.tenant_id
    )
    and public.is_app_manager(auth.uid())
  );
