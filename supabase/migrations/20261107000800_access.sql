-- Access: grants say which actions can reach a table at all, policies say which
-- rows. Roles follow _specs/roles-permissions.md. Anything not granted here is
-- refused.

alter table public.masjids enable row level security;
alter table public.memberships enable row level security;
alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.funds enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.collections enable row level security;
alter table public.bank_lines enable row level security;
alter table public.periods enable row level security;
alter table public.receipt_counters enable row level security;
alter table public.reports enable row level security;
alter table public.khairat_plans enable row level security;
alter table public.khairat_members enable row level security;
alter table public.audit_log enable row level security;

revoke all on all tables in schema public from anon, authenticated;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.user_context() to authenticated, service_role;
grant execute on function private.current_masjid_id() to authenticated, service_role;
grant execute on function private.has_role(text[]) to authenticated, service_role;

-- masjids: `plan` is left out on purpose, it belongs to the platform admin.
grant select on public.masjids to authenticated;
grant update (name, address, state, logo_path, prayer_zone, duitnow_payload)
  on public.masjids to authenticated;

create policy masjids_select on public.masjids for select to authenticated
  using (id = (select private.current_masjid_id()));
create policy masjids_update on public.masjids for update to authenticated
  using (id = (select private.current_masjid_id()) and (select private.has_role('pengerusi')))
  with check (id = (select private.current_masjid_id()));

-- memberships: people are removed by status, so history stays.
grant select, insert on public.memberships to authenticated;
grant update (role, status) on public.memberships to authenticated;

create policy memberships_select on public.memberships for select to authenticated
  using (masjid_id = (select private.current_masjid_id()));
create policy memberships_insert on public.memberships for insert to authenticated
  with check (masjid_id = (select private.current_masjid_id()) and (select private.has_role('pengerusi')));
create policy memberships_update on public.memberships for update to authenticated
  using (masjid_id = (select private.current_masjid_id()) and (select private.has_role('pengerusi')))
  with check (masjid_id = (select private.current_masjid_id()));

-- households, members
grant select, insert, update, delete on public.households, public.members to authenticated;

create policy households_select on public.households for select to authenticated
  using (masjid_id = (select private.current_masjid_id())
    and (select private.has_role('pengerusi', 'bendahari', 'setiausaha', 'ajk')));
create policy households_insert on public.households for insert to authenticated
  with check (masjid_id = (select private.current_masjid_id()) and (select private.has_role('setiausaha')));
create policy households_update on public.households for update to authenticated
  using (masjid_id = (select private.current_masjid_id()) and (select private.has_role('setiausaha')))
  with check (masjid_id = (select private.current_masjid_id()));
create policy households_delete on public.households for delete to authenticated
  using (masjid_id = (select private.current_masjid_id()) and (select private.has_role('setiausaha')));

create policy members_select on public.members for select to authenticated
  using (masjid_id = (select private.current_masjid_id())
    and (select private.has_role('pengerusi', 'bendahari', 'setiausaha', 'ajk')));
create policy members_insert on public.members for insert to authenticated
  with check (masjid_id = (select private.current_masjid_id()) and (select private.has_role('setiausaha')));
create policy members_update on public.members for update to authenticated
  using (masjid_id = (select private.current_masjid_id()) and (select private.has_role('setiausaha')))
  with check (masjid_id = (select private.current_masjid_id()));
create policy members_delete on public.members for delete to authenticated
  using (masjid_id = (select private.current_masjid_id()) and (select private.has_role('setiausaha')));

-- funds, categories
grant select, insert, update on public.funds, public.categories to authenticated;

create policy funds_select on public.funds for select to authenticated
  using (masjid_id = (select private.current_masjid_id()));
create policy funds_insert on public.funds for insert to authenticated
  with check (masjid_id = (select private.current_masjid_id()) and (select private.has_role('pengerusi', 'bendahari')));
create policy funds_update on public.funds for update to authenticated
  using (masjid_id = (select private.current_masjid_id()) and (select private.has_role('pengerusi', 'bendahari')))
  with check (masjid_id = (select private.current_masjid_id()));

create policy categories_select on public.categories for select to authenticated
  using (masjid_id = (select private.current_masjid_id())
    and (select private.has_role('pengerusi', 'bendahari', 'setiausaha', 'ajk')));
create policy categories_insert on public.categories for insert to authenticated
  with check (masjid_id = (select private.current_masjid_id()) and (select private.has_role('pengerusi', 'bendahari')));
create policy categories_update on public.categories for update to authenticated
  using (masjid_id = (select private.current_masjid_id()) and (select private.has_role('pengerusi', 'bendahari')))
  with check (masjid_id = (select private.current_masjid_id()));

-- transactions: Imam sees totals through a protected function, never the rows.
grant select, insert on public.transactions to authenticated;

create policy transactions_select on public.transactions for select to authenticated
  using (masjid_id = (select private.current_masjid_id())
    and (select private.has_role('pengerusi', 'bendahari', 'setiausaha', 'ajk')));
create policy transactions_insert_bendahari on public.transactions for insert to authenticated
  with check (masjid_id = (select private.current_masjid_id())
    and (select private.has_role('bendahari'))
    and created_by = (select auth.uid()));
create policy transactions_insert_reversal on public.transactions for insert to authenticated
  with check (masjid_id = (select private.current_masjid_id())
    and (select private.has_role('pengerusi'))
    and reverses_id is not null
    and created_by = (select auth.uid()));

-- collections: the only change after counting is the confirmation.
grant select, insert on public.collections to authenticated;
grant update (confirmed_by) on public.collections to authenticated;

create policy collections_select on public.collections for select to authenticated
  using (masjid_id = (select private.current_masjid_id())
    and (select private.has_role('pengerusi', 'bendahari', 'setiausaha', 'ajk')));
create policy collections_insert on public.collections for insert to authenticated
  with check (masjid_id = (select private.current_masjid_id())
    and (select private.has_role('bendahari', 'ajk'))
    and counted_by = (select auth.uid())
    and confirmed_by is null
    and transaction_id is null);
create policy collections_confirm on public.collections for update to authenticated
  using (masjid_id = (select private.current_masjid_id())
    and (select private.has_role('pengerusi', 'bendahari', 'ajk')))
  with check (masjid_id = (select private.current_masjid_id())
    and confirmed_by = (select auth.uid()));

-- bank_lines
grant select, insert, update, delete on public.bank_lines to authenticated;

create policy bank_lines_select on public.bank_lines for select to authenticated
  using (masjid_id = (select private.current_masjid_id()) and (select private.has_role('pengerusi', 'bendahari')));
create policy bank_lines_insert on public.bank_lines for insert to authenticated
  with check (masjid_id = (select private.current_masjid_id()) and (select private.has_role('bendahari')));
create policy bank_lines_update on public.bank_lines for update to authenticated
  using (masjid_id = (select private.current_masjid_id()) and (select private.has_role('bendahari')))
  with check (masjid_id = (select private.current_masjid_id()));
create policy bank_lines_delete on public.bank_lines for delete to authenticated
  using (masjid_id = (select private.current_masjid_id()) and (select private.has_role('bendahari')));

-- periods
grant select, insert on public.periods to authenticated;
grant update (locked_at, unlock_reason) on public.periods to authenticated;

create policy periods_select on public.periods for select to authenticated
  using (masjid_id = (select private.current_masjid_id()));
create policy periods_insert on public.periods for insert to authenticated
  with check (masjid_id = (select private.current_masjid_id()) and (select private.has_role('pengerusi')));
create policy periods_update on public.periods for update to authenticated
  using (masjid_id = (select private.current_masjid_id()) and (select private.has_role('pengerusi')))
  with check (masjid_id = (select private.current_masjid_id()));

-- receipt_counters: read only here. Numbers are issued by a function in Step 8,
-- so they stay gapless.
grant select on public.receipt_counters to authenticated;

create policy receipt_counters_select on public.receipt_counters for select to authenticated
  using (masjid_id = (select private.current_masjid_id()) and (select private.has_role('pengerusi', 'bendahari')));

-- reports
grant select, insert on public.reports to authenticated;

create policy reports_select on public.reports for select to authenticated
  using (masjid_id = (select private.current_masjid_id())
    and (select private.has_role('pengerusi', 'bendahari', 'setiausaha')));
create policy reports_insert on public.reports for insert to authenticated
  with check (masjid_id = (select private.current_masjid_id())
    and (select private.has_role('pengerusi', 'bendahari', 'setiausaha'))
    and generated_by = (select auth.uid()));

-- khairat
grant select, insert, update on public.khairat_plans, public.khairat_members to authenticated;

create policy khairat_plans_select on public.khairat_plans for select to authenticated
  using (masjid_id = (select private.current_masjid_id())
    and (select private.has_role('pengerusi', 'bendahari', 'setiausaha', 'ajk')));
create policy khairat_plans_insert on public.khairat_plans for insert to authenticated
  with check (masjid_id = (select private.current_masjid_id()) and (select private.has_role('pengerusi', 'bendahari')));
create policy khairat_plans_update on public.khairat_plans for update to authenticated
  using (masjid_id = (select private.current_masjid_id()) and (select private.has_role('pengerusi', 'bendahari')))
  with check (masjid_id = (select private.current_masjid_id()));

create policy khairat_members_select on public.khairat_members for select to authenticated
  using (masjid_id = (select private.current_masjid_id())
    and (select private.has_role('pengerusi', 'bendahari', 'setiausaha', 'ajk')));
create policy khairat_members_insert on public.khairat_members for insert to authenticated
  with check (masjid_id = (select private.current_masjid_id()) and (select private.has_role('bendahari', 'setiausaha')));
create policy khairat_members_update on public.khairat_members for update to authenticated
  using (masjid_id = (select private.current_masjid_id()) and (select private.has_role('bendahari', 'setiausaha')))
  with check (masjid_id = (select private.current_masjid_id()));

-- audit_log: written only by the audit trigger. Even the service role can only read.
grant select on public.audit_log to authenticated;

create policy audit_log_select on public.audit_log for select to authenticated
  using (masjid_id = (select private.current_masjid_id()) and (select private.has_role('pengerusi', 'bendahari')));

grant select, insert, update, delete on all tables in schema public to service_role;
revoke all on public.audit_log from service_role;
grant select on public.audit_log to service_role;

-- Lets the isolation tests read the real table list, so a new table cannot
-- slip through without row security, an audit trigger and a test.
create function public.security_coverage()
returns table (table_name text, rls_enabled boolean, has_audit_trigger boolean, policy_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.relname::text,
    c.relrowsecurity,
    exists (
      select 1 from pg_catalog.pg_trigger t
      where t.tgrelid = c.oid and t.tgname = 'audit_row' and not t.tgisinternal
    ),
    (select count(*)::integer from pg_catalog.pg_policies p
      where p.schemaname = 'public' and p.tablename = c.relname)
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname;
$$;

revoke all on function public.security_coverage() from public, anon, authenticated;
grant execute on function public.security_coverage() to service_role;
