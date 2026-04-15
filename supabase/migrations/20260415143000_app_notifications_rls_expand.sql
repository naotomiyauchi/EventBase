-- app_notifications: managers may also see rows for tenants where staff.email matches JWT email
-- (when profile.tenant_id and LINE/staff tenant differ across hosts)

drop policy if exists "app_notifications_access" on public.app_notifications;

create policy "app_notifications_access"
  on public.app_notifications
  for all
  to authenticated
  using (
    public.is_app_manager(auth.uid())
    and (
      public.is_admin(auth.uid())
      or tenant_id = public.current_tenant_id()
      or tenant_id in (
        select s.tenant_id
        from public.staff s
        where s.email is not null
          and lower(trim(s.email)) = lower(trim(coalesce(auth.jwt()->>'email', '')))
      )
    )
  )
  with check (
    public.is_app_manager(auth.uid())
    and (
      public.is_admin(auth.uid())
      or tenant_id = public.current_tenant_id()
      or tenant_id in (
        select s.tenant_id
        from public.staff s
        where s.email is not null
          and lower(trim(s.email)) = lower(trim(coalesce(auth.jwt()->>'email', '')))
      )
    )
  );
