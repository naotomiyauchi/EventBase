-- LINE公式連携: ユーザー紐付け / 通知ログ / Webhookログ

create table if not exists public.line_user_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  line_user_id text not null,
  line_display_name text,
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, staff_id),
  unique (tenant_id, line_user_id)
);

create table if not exists public.line_shift_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  shift_id uuid references public.project_shifts (id) on delete set null,
  staff_id uuid references public.staff (id) on delete set null,
  line_user_id text not null,
  notification_type text not null default 'shift_publish',
  message text not null,
  provider_message_id text,
  status text not null default 'sent',
  sent_at timestamptz not null default now()
);

create table if not exists public.line_webhook_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete set null,
  event_type text not null,
  line_user_id text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'ok',
  note text,
  created_at timestamptz not null default now()
);

create index if not exists line_user_links_tenant_staff_idx
  on public.line_user_links (tenant_id, staff_id);
create index if not exists line_shift_notifications_tenant_sent_idx
  on public.line_shift_notifications (tenant_id, sent_at desc);
create index if not exists line_webhook_logs_tenant_created_idx
  on public.line_webhook_logs (tenant_id, created_at desc);

drop trigger if exists line_user_links_bump_updated_at on public.line_user_links;
create trigger line_user_links_bump_updated_at
  before update on public.line_user_links
  for each row execute function public.bump_updated_at();

alter table public.line_user_links enable row level security;
alter table public.line_shift_notifications enable row level security;
alter table public.line_webhook_logs enable row level security;

create policy "line_user_links_access" on public.line_user_links
  for all to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  );

create policy "line_shift_notifications_access" on public.line_shift_notifications
  for all to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  );

create policy "line_webhook_logs_access" on public.line_webhook_logs
  for all to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  );
