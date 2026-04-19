alter table public.finance_receipts
  add column if not exists staff_id uuid references public.staff (id) on delete set null;

create index if not exists finance_receipts_staff_id_idx
  on public.finance_receipts (staff_id, expense_date desc);

update public.finance_receipts fr
set staff_id = ps.staff_id
from public.project_shifts ps
where fr.staff_id is null
  and fr.shift_id = ps.id;

drop policy if exists "finance_receipts_access" on public.finance_receipts;

create policy "finance_receipts_select_access" on public.finance_receipts
  for select to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (
      public.is_app_manager(auth.uid())
      or exists (
        select 1
        from public.staff s
        where s.id = finance_receipts.staff_id
          and s.tenant_id = public.current_tenant_id()
          and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
      )
    )
  );

create policy "finance_receipts_insert_manager" on public.finance_receipts
  for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  );

create policy "finance_receipts_update_access" on public.finance_receipts
  for update to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (
      public.is_app_manager(auth.uid())
      or exists (
        select 1
        from public.staff s
        where s.id = finance_receipts.staff_id
          and s.tenant_id = public.current_tenant_id()
          and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
      )
    )
  )
  with check (
    tenant_id = public.current_tenant_id()
    and (
      public.is_app_manager(auth.uid())
      or exists (
        select 1
        from public.staff s
        where s.id = finance_receipts.staff_id
          and s.tenant_id = public.current_tenant_id()
          and lower(coalesce(s.email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
      )
    )
  );

create policy "finance_receipts_delete_manager" on public.finance_receipts
  for delete to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and public.is_app_manager(auth.uid())
  );
