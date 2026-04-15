-- Project-first schema expansion (non-destructive)

alter table public.projects
  add column if not exists overview text,
  add column if not exists event_period_start date,
  add column if not exists event_period_end date,
  add column if not exists event_start_at timestamptz,
  add column if not exists event_end_at timestamptz,
  add column if not exists event_location text,
  add column if not exists event_location_map_url text,
  add column if not exists event_contact_name text,
  add column if not exists event_contact_phone text,
  add column if not exists event_notes text,
  add column if not exists related_entities text,
  add column if not exists direct_supervisor_entity text,
  add column if not exists billing_target_entity text,
  add column if not exists compensation_type text,
  add column if not exists brokerage_rate numeric(6,2),
  add column if not exists brokerage_notes text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_compensation_type_check'
  ) then
    alter table public.projects
      add constraint projects_compensation_type_check
      check (
        compensation_type is null
        or compensation_type in ('daily', 'commission')
      );
  end if;
end $$;

create index if not exists projects_event_period_start_idx
  on public.projects (event_period_start desc);
