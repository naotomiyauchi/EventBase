-- LINE入力セッション（リッチメニュー押下後の対話ステップ）

create table if not exists public.line_input_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  line_user_id text not null,
  mode text not null, -- link / unavailable
  status text not null default 'awaiting_input',
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, line_user_id)
);

drop trigger if exists line_input_sessions_bump_updated_at on public.line_input_sessions;
create trigger line_input_sessions_bump_updated_at
  before update on public.line_input_sessions
  for each row execute function public.bump_updated_at();

alter table public.line_input_sessions enable row level security;

create policy "line_input_sessions_access" on public.line_input_sessions
  for all to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  );
