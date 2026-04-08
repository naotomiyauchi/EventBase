-- シフト公開/承諾ステータス（管理者の一括運用向け）

create type public.shift_publish_status as enum ('draft', 'published');
create type public.shift_response_status as enum ('unread', 'read', 'accepted', 'declined');

alter table public.project_shifts
  add column if not exists publish_status public.shift_publish_status not null default 'draft',
  add column if not exists staff_response_status public.shift_response_status not null default 'unread',
  add column if not exists published_at timestamptz,
  add column if not exists notified_at timestamptz;

create index if not exists project_shifts_publish_status_idx
  on public.project_shifts (publish_status, scheduled_start_at);
