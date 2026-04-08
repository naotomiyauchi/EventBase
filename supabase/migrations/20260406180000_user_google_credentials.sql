-- ユーザーロール（管理者 / チームリーダー / スタッフ）
-- Google スプレッドシート連携（管理者・チームリーダーのリフレッシュトークン）
-- 既存 profiles.role (text) を enum へ移行

create type public.app_role as enum ('admin', 'team_leader', 'staff');

-- 既存データを enum に載せ替え
alter table public.profiles
  alter column role drop default;

alter table public.profiles
  alter column role type public.app_role
  using (
    case coalesce(role::text, 'staff')
      when 'admin' then 'admin'::public.app_role
      when 'team_leader' then 'team_leader'::public.app_role
      when 'staff' then 'staff'::public.app_role
      else 'staff'::public.app_role
    end
  );

alter table public.profiles
  alter column role set default 'staff'::public.app_role;

-- 公開サインアップのデフォルトはスタッフ（管理者は招待または昇格のみ）
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role = 'admin'::public.app_role
  );
$$;

create or replace function public.is_team_leader(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role = 'team_leader'::public.app_role
  );
$$;

create or replace function public.is_app_manager(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role in ('admin'::public.app_role, 'team_leader'::public.app_role)
  );
$$;

grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_team_leader(uuid) to authenticated;
grant execute on function public.is_app_manager(uuid) to authenticated;

create policy "profiles_select_access"
  on public.profiles
  for select
  to authenticated
  using (
    auth.uid() = id
    or public.is_app_manager(auth.uid())
  );

create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_update_admin"
  on public.profiles
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "profiles_update_tl_staff_only"
  on public.profiles
  for update
  to authenticated
  using (
    public.is_team_leader(auth.uid())
    and exists (
      select 1
      from public.profiles tp
      where tp.id = profiles.id
        and tp.role = 'staff'::public.app_role
    )
  )
  with check (
    public.is_team_leader(auth.uid())
    and exists (
      select 1
      from public.profiles tp
      where tp.id = profiles.id
        and tp.role = 'staff'::public.app_role
    )
  );

-- 新規 auth ユーザー: 先頭 1 件目は管理者（初期ブートストラップ）。以降は metadata.app_role またはスタッフ
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.app_role;
  existing_count int;
begin
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

  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    ),
    r
  );
  return new;
end;
$$;

-- Google 連携（管理者・チームリーダーのみ保持想定。検証はアプリ側）
drop table if exists public.user_google_credentials cascade;

create table public.user_google_credentials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  google_refresh_token text not null,
  updated_at timestamptz not null default now()
);

create index if not exists user_google_credentials_updated_at_idx
  on public.user_google_credentials (updated_at desc);

alter table public.user_google_credentials enable row level security;

create policy "user_google_credentials_own_all"
  on public.user_google_credentials
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_google_credentials_admin_read"
  on public.user_google_credentials
  for select
  to authenticated
  using (public.is_admin(auth.uid()));

-- エクスポート API 用: 本人ロールに応じて参照するトークンを返す（スタッフは先頭の管理者のトークン）
create or replace function public.get_google_refresh_token_for_export()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  viewer_role public.app_role;
  tok text;
begin
  if viewer is null then
    return null;
  end if;

  select role into viewer_role from public.profiles where id = viewer;
  if viewer_role is null then
    return null;
  end if;

  if viewer_role in ('admin'::public.app_role, 'team_leader'::public.app_role) then
    select google_refresh_token into tok
    from public.user_google_credentials
    where user_id = viewer;
    return tok;
  end if;

  if viewer_role = 'staff'::public.app_role then
    select ugc.google_refresh_token into tok
    from public.user_google_credentials ugc
    inner join public.profiles p on p.id = ugc.user_id
    where p.role = 'admin'::public.app_role
    order by p.created_at asc
    limit 1;
    return tok;
  end if;

  return null;
end;
$$;

grant execute on function public.get_google_refresh_token_for_export() to authenticated;
