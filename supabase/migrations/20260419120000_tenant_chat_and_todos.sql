-- 社内チャット（同一テナントのみ）・ToDo（プライベート / パブリック）

-- ── チャット ─────────────────────────────────────────
create table public.tenant_chat_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_display_name text not null default '',
  body text not null,
  created_at timestamptz not null default now(),
  constraint tenant_chat_messages_body_nonempty check (length(trim(body)) > 0)
);

create index tenant_chat_messages_tenant_created_idx
  on public.tenant_chat_messages (tenant_id, created_at desc);

create or replace function public.tenant_chat_fill_author_display()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(nullif(trim(p.display_name), ''), 'メンバー')
  into new.author_display_name
  from public.profiles p
  where p.id = new.author_id;
  if new.author_display_name is null then
    new.author_display_name := 'メンバー';
  end if;
  return new;
end;
$$;

drop trigger if exists tenant_chat_messages_fill_author on public.tenant_chat_messages;
create trigger tenant_chat_messages_fill_author
  before insert on public.tenant_chat_messages
  for each row execute function public.tenant_chat_fill_author_display();

alter table public.tenant_chat_messages enable row level security;

create policy "tenant_chat_messages_select"
  on public.tenant_chat_messages
  for select
  to authenticated
  using (tenant_id = public.current_tenant_id());

create policy "tenant_chat_messages_insert"
  on public.tenant_chat_messages
  for insert
  to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and author_id = auth.uid()
  );

create policy "tenant_chat_messages_update_own"
  on public.tenant_chat_messages
  for update
  to authenticated
  using (tenant_id = public.current_tenant_id() and author_id = auth.uid())
  with check (tenant_id = public.current_tenant_id() and author_id = auth.uid());

create policy "tenant_chat_messages_delete_own"
  on public.tenant_chat_messages
  for delete
  to authenticated
  using (tenant_id = public.current_tenant_id() and author_id = auth.uid());

-- ── ToDo ─────────────────────────────────────────────
create table public.tenant_todos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  visibility text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_todos_visibility_check check (visibility in ('private', 'public')),
  constraint tenant_todos_title_nonempty check (length(trim(title)) > 0)
);

create index tenant_todos_tenant_owner_idx
  on public.tenant_todos (tenant_id, owner_id, created_at desc);

create index tenant_todos_tenant_public_idx
  on public.tenant_todos (tenant_id, visibility, created_at desc);

create or replace function public.tenant_todos_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tenant_todos_updated_at on public.tenant_todos;
create trigger tenant_todos_updated_at
  before update on public.tenant_todos
  for each row execute function public.tenant_todos_set_updated_at();

create or replace function public.tenant_todos_validate_mutate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_tenant uuid;
begin
  if tg_op = 'INSERT' then
    if new.tenant_id is distinct from public.current_tenant_id() then
      raise exception 'tenant mismatch';
    end if;
    if new.created_by is distinct from auth.uid() then
      raise exception 'invalid created_by';
    end if;
    select p.tenant_id into owner_tenant
    from public.profiles p
    where p.id = new.owner_id;
    if owner_tenant is null or owner_tenant is distinct from new.tenant_id then
      raise exception 'owner not in tenant';
    end if;
    if new.visibility = 'private' and new.owner_id is distinct from auth.uid() then
      raise exception 'private todo must be for self';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.tenant_id is distinct from old.tenant_id
       or new.id is distinct from old.id then
      raise exception 'cannot change identity';
    end if;
    if new.owner_id is distinct from old.owner_id then
      raise exception 'cannot reassign owner';
    end if;
    if new.created_by is distinct from old.created_by then
      raise exception 'cannot change created_by';
    end if;
    if new.visibility is distinct from old.visibility
       and auth.uid() is distinct from old.owner_id then
      raise exception 'only owner can change visibility';
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists tenant_todos_validate_insert on public.tenant_todos;
create trigger tenant_todos_validate_insert
  before insert on public.tenant_todos
  for each row execute function public.tenant_todos_validate_mutate();

drop trigger if exists tenant_todos_validate_update on public.tenant_todos;
create trigger tenant_todos_validate_update
  before update on public.tenant_todos
  for each row execute function public.tenant_todos_validate_mutate();

alter table public.tenant_todos enable row level security;

-- 自分のプライベート or テナント内のパブリック
create policy "tenant_todos_select"
  on public.tenant_todos
  for select
  to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (
      (visibility = 'private' and owner_id = auth.uid())
      or visibility = 'public'
    )
  );

create policy "tenant_todos_insert"
  on public.tenant_todos
  for insert
  to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and created_by = auth.uid()
  );

-- 本人は自分の ToDo 全件更新可 / パブリックかつ自分が作成した他人宛は作成者も更新可
create policy "tenant_todos_update"
  on public.tenant_todos
  for update
  to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (
      owner_id = auth.uid()
      or (visibility = 'public' and created_by = auth.uid())
    )
  )
  with check (
    tenant_id = public.current_tenant_id()
    and (
      owner_id = auth.uid()
      or (visibility = 'public' and created_by = auth.uid())
    )
  );

create policy "tenant_todos_delete"
  on public.tenant_todos
  for delete
  to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (
      owner_id = auth.uid()
      or (visibility = 'public' and created_by = auth.uid())
    )
  );

-- 同テナントのプロフィール一覧（表示名付き）— profiles の狭い SELECT を補う
create or replace function public.tenant_profile_directory()
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, coalesce(nullif(trim(p.display_name), ''), 'メンバー')::text as display_name
  from public.profiles p
  where p.tenant_id = public.current_tenant_id()
  order by display_name asc, p.id asc;
$$;

grant execute on function public.tenant_profile_directory() to authenticated;

-- Realtime（利用環境に publication がある場合のみ）
do $$
begin
  alter publication supabase_realtime add table public.tenant_chat_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;
