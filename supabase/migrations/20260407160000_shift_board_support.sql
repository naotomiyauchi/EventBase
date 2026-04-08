-- スプレッドシート型シフト表（セル=スタッフ×日）向けの土台

alter table public.project_shifts
  add column if not exists shift_date date;

-- 既存データを JST 日付で埋める
update public.project_shifts
set shift_date = (scheduled_start_at at time zone 'Asia/Tokyo')::date
where shift_date is null and scheduled_start_at is not null;

alter table public.project_shifts
  alter column shift_date set not null;

-- 1スタッフ1日=1セル（キャンセルは別扱いにしたい場合は見直し）
drop index if exists project_shifts_staff_shift_date_uq;
create unique index project_shifts_staff_shift_date_uq
  on public.project_shifts (staff_id, shift_date);

create index if not exists project_shifts_shift_date_idx
  on public.project_shifts (shift_date);
