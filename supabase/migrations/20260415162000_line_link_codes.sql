-- LINE連携コード（メール送信→LINEで6桁入力）

create table if not exists public.line_link_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  email text not null,
  code text not null check (code ~ '^[0-9]{6}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_line_user_id text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists line_link_codes_tenant_email_idx
  on public.line_link_codes (tenant_id, email, created_at desc);
create index if not exists line_link_codes_tenant_staff_idx
  on public.line_link_codes (tenant_id, staff_id, created_at desc);
create index if not exists line_link_codes_active_idx
  on public.line_link_codes (tenant_id, code, expires_at)
  where used_at is null;

alter table public.line_link_codes enable row level security;

create policy "line_link_codes_access"
  on public.line_link_codes
  for all
  to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  );
