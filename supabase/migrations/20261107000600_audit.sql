-- Audit log: every insert, update and delete on every table, kept forever.
-- masjid_id and user_id are plain columns, not foreign keys, so a log row
-- outlives whatever it describes.

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null,
  user_id uuid,
  table_name text not null,
  row_id uuid not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);

create index audit_log_masjid_at_idx on public.audit_log (masjid_id, at desc);
create index audit_log_row_idx on public.audit_log (table_name, row_id);

create trigger audit_log_no_change before update or delete on public.audit_log
  for each row execute function private.reject_change();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function private.reject_change();

-- Trigger arguments name the columns that hold personal data. The log can never
-- be deleted, so their values are not stored: it records that a field changed,
-- not what it said.
create function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  new_row jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  source jsonb := coalesce(new_row, old_row);
  col text;
  changed boolean;
begin
  for i in 0 .. tg_nargs - 1 loop
    col := tg_argv[i];
    changed := tg_op = 'UPDATE' and (old_row -> col) is distinct from (new_row -> col);

    if old_row is not null and jsonb_typeof(old_row -> col) <> 'null' then
      old_row := jsonb_set(old_row, array[col], to_jsonb(
        case when changed then '[changed]' else '[hidden]' end));
    end if;

    if new_row is not null and jsonb_typeof(new_row -> col) <> 'null' then
      new_row := jsonb_set(new_row, array[col], to_jsonb(
        case when changed then '[changed]' else '[hidden]' end));
    end if;
  end loop;

  insert into public.audit_log (masjid_id, user_id, table_name, row_id, action, before, after)
  values (
    coalesce(source ->> 'masjid_id', source ->> 'id')::uuid,
    auth.uid(),
    tg_table_name,
    (source ->> 'id')::uuid,
    tg_op,
    old_row,
    new_row
  );

  return null;
end;
$$;

create trigger audit_row after insert or update or delete on public.masjids
  for each row execute function private.audit_row();
create trigger audit_row after insert or update or delete on public.memberships
  for each row execute function private.audit_row();
create trigger audit_row after insert or update or delete on public.households
  for each row execute function private.audit_row('head_name', 'address', 'phone');
create trigger audit_row after insert or update or delete on public.members
  for each row execute function private.audit_row('name', 'ic_last4', 'date_of_birth', 'relation');
create trigger audit_row after insert or update or delete on public.funds
  for each row execute function private.audit_row();
create trigger audit_row after insert or update or delete on public.categories
  for each row execute function private.audit_row();
create trigger audit_row after insert or update or delete on public.transactions
  for each row execute function private.audit_row();
create trigger audit_row after insert or update or delete on public.collections
  for each row execute function private.audit_row();
-- Bank descriptions often carry the sender's name.
create trigger audit_row after insert or update or delete on public.bank_lines
  for each row execute function private.audit_row('description');
create trigger audit_row after insert or update or delete on public.periods
  for each row execute function private.audit_row();
create trigger audit_row after insert or update or delete on public.receipt_counters
  for each row execute function private.audit_row();
create trigger audit_row after insert or update or delete on public.reports
  for each row execute function private.audit_row();
create trigger audit_row after insert or update or delete on public.khairat_plans
  for each row execute function private.audit_row();
create trigger audit_row after insert or update or delete on public.khairat_members
  for each row execute function private.audit_row();
