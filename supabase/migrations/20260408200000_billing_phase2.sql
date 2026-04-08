-- 請求/見積 Phase 2: 自由明細・送信履歴・見積承認

alter table public.billing_documents
  add column if not exists recipient_email text,
  add column if not exists recipient_name text,
  add column if not exists bcc_email text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users (id) on delete set null,
  add column if not exists sign_provider text,
  add column if not exists sign_reference text;

create table if not exists public.billing_send_logs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.billing_documents (id) on delete cascade,
  to_email text not null,
  bcc_email text,
  subject text not null,
  body text,
  provider text,
  provider_message_id text,
  sent_by uuid references auth.users (id) on delete set null,
  sent_at timestamptz not null default now(),
  status text not null default 'sent'
);

create index if not exists billing_send_logs_document_id_idx
  on public.billing_send_logs (document_id, sent_at desc);

alter table public.billing_send_logs enable row level security;

create policy "billing_send_logs_access" on public.billing_send_logs
  for all to authenticated
  using (public.is_app_manager(auth.uid()))
  with check (public.is_app_manager(auth.uid()));

