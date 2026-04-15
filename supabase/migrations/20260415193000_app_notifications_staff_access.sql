-- app_notifications: allow staff to read and mark own targeted notifications

drop policy if exists "app_notifications_access" on public.app_notifications;
drop policy if exists "app_notifications_manager_all" on public.app_notifications;
drop policy if exists "app_notifications_staff_read_own" on public.app_notifications;
drop policy if exists "app_notifications_staff_update_own" on public.app_notifications;

create policy "app_notifications_manager_all" on public.app_notifications
  for all to authenticated
  using (
    public.is_app_manager(auth.uid())
    and (
      public.is_admin(auth.uid())
      or tenant_id = public.current_tenant_id()
      or exists (
        select 1
        from public.staff s
        where s.tenant_id = app_notifications.tenant_id
          and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
      )
    )
  )
  with check (
    public.is_app_manager(auth.uid())
    and (
      public.is_admin(auth.uid())
      or tenant_id = public.current_tenant_id()
      or exists (
        select 1
        from public.staff s
        where s.tenant_id = app_notifications.tenant_id
          and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
      )
    )
  );

create policy "app_notifications_staff_read_own" on public.app_notifications
  for select to authenticated
  using (
    lower(coalesce(metadata->>'target_email', '')) = lower(coalesce(auth.jwt()->>'email', ''))
  );

create policy "app_notifications_staff_update_own" on public.app_notifications
  for update to authenticated
  using (
    lower(coalesce(metadata->>'target_email', '')) = lower(coalesce(auth.jwt()->>'email', ''))
  )
  with check (
    lower(coalesce(metadata->>'target_email', '')) = lower(coalesce(auth.jwt()->>'email', ''))
  );
