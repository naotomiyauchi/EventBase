-- アプリ内通知（ヘッダーの通知マーク）

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists app_notifications_tenant_created_idx
  on public.app_notifications (tenant_id, created_at desc);
create index if not exists app_notifications_tenant_read_idx
  on public.app_notifications (tenant_id, read_at, created_at desc);

alter table public.app_notifications enable row level security;

create policy "app_notifications_access" on public.app_notifications
  for all to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  );
