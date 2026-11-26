-- Step 6: funds, categories, the cash book, reversals, attachments and the
-- figures for the dashboard. Money stays in integer sen.

-- Funds and categories can be archived. Archived ones stay in history and
-- reports but are not offered for new entries.
alter table public.funds add column archived_at timestamptz;
alter table public.categories add column archived_at timestamptz;

alter table public.funds add constraint funds_name_length check (length(name) <= 60);
alter table public.categories add constraint categories_name_length check (length(name) <= 60);

-- A fund can only be archived when its balance is zero, so money never
-- disappears from view.
create function private.guard_fund()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  balance bigint;
begin
  if new.archived_at is not null and old.archived_at is null then
    select coalesce(sum(case when t.direction = 'in' then t.amount_sen else -t.amount_sen end), 0)
    into balance
    from public.transactions t
    where t.masjid_id = old.masjid_id and t.fund_id = old.id;

    if balance <> 0 then
      raise exception 'funds: a fund with money in it cannot be archived';
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_fund before update on public.funds
  for each row execute function private.guard_fund();

-- Transactions: a note, the reason for a reversal, and an attachment.
alter table public.transactions add column note text;
alter table public.transactions add column reversal_reason text;
alter table public.transactions add column attachment_path text;

alter table public.transactions add constraint transactions_note_length
  check (note is null or length(note) <= 500);
alter table public.transactions add constraint transactions_reason_length
  check (reversal_reason is null or length(reversal_reason) <= 300);
alter table public.transactions add constraint transactions_ref_no_length
  check (ref_no is null or length(ref_no) <= 60);
-- An attachment must be a file in the masjid's own folder.
alter table public.transactions add constraint transactions_attachment_in_own_folder
  check (attachment_path is null or attachment_path like 'masjids/' || masjid_id::text || '/%');

create index transactions_masjid_fund_date_idx on public.transactions (masjid_id, fund_id, date);
create index transactions_attachment_idx on public.transactions (attachment_path)
  where attachment_path is not null;

-- Rules for every new entry. They live in a trigger rather than a check so
-- they apply to new rows only: rows already saved can never change.
create function private.check_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  fund public.funds;
  category public.categories;
  original public.transactions;
begin
  if new.date > today then
    raise exception 'transaction: the date is in the future';
  end if;

  select * into fund from public.funds f where f.id = new.fund_id and f.masjid_id = new.masjid_id;
  if found and fund.archived_at is not null then
    raise exception 'transaction: the fund is archived';
  end if;

  if new.reverses_id is null then
    if new.reversal_reason is not null then
      raise exception 'transaction: only a reversal has a reason';
    end if;

    if new.category_id is not null then
      select * into category from public.categories c
      where c.id = new.category_id and c.masjid_id = new.masjid_id;
      if found then
        if category.archived_at is not null then
          raise exception 'transaction: the category is archived';
        end if;
        if (category.type = 'income') <> (new.direction = 'in') then
          raise exception 'transaction: the category does not match receipt or payment';
        end if;
      end if;
    end if;
  else
    if length(trim(coalesce(new.reversal_reason, ''))) = 0 then
      raise exception 'reversal: a reason is required';
    end if;

    select * into original from public.transactions t
    where t.id = new.reverses_id and t.masjid_id = new.masjid_id;
    if found then
      if new.category_id is distinct from original.category_id then
        raise exception 'reversal: must keep the category of the original';
      end if;
      if new.date < original.date then
        raise exception 'reversal: cannot be dated before the original';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger check_transaction before insert on public.transactions
  for each row execute function private.check_transaction();

-- Figures -------------------------------------------------------------------

-- Each fund's opening balance, money in, money out and closing balance for a
-- date range. A reversal counts against the side of the entry it cancels, so
-- a cancelled receipt lowers income instead of adding an expense. Runs with
-- the caller's own rights, so row security applies.
create function public.fund_summary(p_from date default null, p_to date default null)
returns table (
  id uuid,
  name text,
  restricted boolean,
  archived_at timestamptz,
  opening_sen bigint,
  in_sen bigint,
  out_sen bigint,
  closing_sen bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with entries as (
    select
      t.fund_id,
      t.date,
      case when t.direction = 'in' then t.amount_sen else -t.amount_sen end as signed,
      case
        when t.reverses_id is null and t.direction = 'in' then t.amount_sen
        when t.reverses_id is not null and t.direction = 'out' then -t.amount_sen
        else 0
      end as income,
      case
        when t.reverses_id is null and t.direction = 'out' then t.amount_sen
        when t.reverses_id is not null and t.direction = 'in' then -t.amount_sen
        else 0
      end as expense
    from public.transactions t
    where t.masjid_id = (select private.current_masjid_id())
      and (p_to is null or t.date <= p_to)
  )
  select
    f.id,
    f.name,
    f.restricted,
    f.archived_at,
    coalesce(sum(e.signed) filter (where p_from is not null and e.date < p_from), 0)::bigint,
    coalesce(sum(e.income) filter (where p_from is null or e.date >= p_from), 0)::bigint,
    coalesce(sum(e.expense) filter (where p_from is null or e.date >= p_from), 0)::bigint,
    coalesce(sum(e.signed), 0)::bigint
  from public.funds f
  left join entries e on e.fund_id = f.id
  where f.masjid_id = (select private.current_masjid_id())
    and (select private.has_role('pengerusi', 'bendahari', 'setiausaha', 'ajk'))
  group by f.id
  order by f.archived_at nulls first, f.created_at, f.name;
$$;

-- The total of all funds and one month's income and expense. The Imam may see
-- these totals but not the entries, so this runs with the owner's rights and
-- checks the caller itself.
create function public.masjid_totals(p_month date)
returns table (total_sen bigint, month_in_sen bigint, month_out_sen bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with month as (
    select date_trunc('month', p_month::timestamp)::date as first_day
  )
  select
    coalesce(sum(case when t.direction = 'in' then t.amount_sen else -t.amount_sen end), 0)::bigint,
    coalesce(sum(
      case
        when t.reverses_id is null and t.direction = 'in' then t.amount_sen
        when t.reverses_id is not null and t.direction = 'out' then -t.amount_sen
        else 0
      end
    ) filter (where t.date >= m.first_day and t.date < (m.first_day + interval '1 month')::date), 0)::bigint,
    coalesce(sum(
      case
        when t.reverses_id is null and t.direction = 'out' then t.amount_sen
        when t.reverses_id is not null and t.direction = 'in' then -t.amount_sen
        else 0
      end
    ) filter (where t.date >= m.first_day and t.date < (m.first_day + interval '1 month')::date), 0)::bigint
  from month m
  left join public.transactions t on t.masjid_id = private.current_masjid_id()
  having private.has_role('pengerusi', 'bendahari', 'setiausaha', 'ajk', 'imam');
$$;

revoke all on function public.fund_summary(date, date) from public, anon;
revoke all on function public.masjid_totals(date) from public, anon;
grant execute on function public.fund_summary(date, date) to authenticated;
grant execute on function public.masjid_totals(date) to authenticated;

-- Default funds and categories for new masjids --------------------------------

-- Asas allows 2 funds, so it starts with the two every masjid has.
create or replace function public.create_masjid(p_name text, p_state text, p_address text, p_prayer_zone text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
  new_plan text;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if private.flagged_platform_admin() then
    raise exception 'platform_admin' using errcode = '42501';
  end if;
  if exists (select 1 from public.memberships m where m.user_id = uid) then
    raise exception 'already_member' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'name_required' using errcode = '22023';
  end if;

  insert into public.masjids (name, state, address, prayer_zone)
  values (trim(p_name), nullif(trim(p_state), ''), nullif(trim(p_address), ''), nullif(trim(p_prayer_zone), ''))
  returning id, plan into new_id, new_plan;

  insert into public.memberships (user_id, masjid_id, role, status)
  values (uid, new_id, 'pengerusi', 'active');

  insert into public.funds (masjid_id, name, restricted)
  select new_id, f.name, f.restricted
  from (values
    (1, 'Tabung Am', false),
    (2, 'Pembangunan', true),
    (3, 'Khairat Kematian', true),
    (4, 'Amal Jariah', false)
  ) as f (n, name, restricted)
  where new_plan <> 'asas' or f.n <= 2
  order by f.n;

  insert into public.categories (masjid_id, name, type)
  select new_id, c.name, c.type
  from (values
    (1, 'Kutipan Jumaat', 'income'),
    (2, 'Derma', 'income'),
    (3, 'Sewaan dewan', 'income'),
    (4, 'Khairat', 'income'),
    (5, 'Lain-lain', 'income'),
    (6, 'Bil elektrik/air', 'expense'),
    (7, 'Gaji', 'expense'),
    (8, 'Penyelenggaraan', 'expense'),
    (9, 'Kebajikan', 'expense'),
    (10, 'Lain-lain', 'expense')
  ) as c (n, name, type)
  order by c.n;

  return new_id;
end;
$$;

-- Attachments ---------------------------------------------------------------

-- Photos or PDFs of receipts and bills, at masjids/<masjid_id>/<file>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'transaction-files',
  'transaction-files',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- True when an object path sits directly in the caller's own masjid folder.
create function private.in_own_masjid_folder(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (storage.foldername(object_name))[1] = 'masjids'
    and (storage.foldername(object_name))[2] = private.current_masjid_id()::text
    and array_length(storage.foldername(object_name), 1) = 2;
$$;

-- True when a saved entry points at the file. Such files are evidence and can
-- never be removed.
create function private.attachment_in_use(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.transactions t where t.attachment_path = object_name);
$$;

revoke all on function private.in_own_masjid_folder(text) from public, anon;
revoke all on function private.attachment_in_use(text) from public, anon;
grant execute on function private.in_own_masjid_folder(text) to authenticated;
grant execute on function private.attachment_in_use(text) to authenticated;

create policy transaction_files_read on storage.objects for select to authenticated
  using (bucket_id = 'transaction-files'
    and private.in_own_masjid_folder(name)
    and (select private.has_role('pengerusi', 'bendahari', 'setiausaha', 'ajk')));

create policy transaction_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'transaction-files'
    and private.in_own_masjid_folder(name)
    and (select private.has_role('bendahari')));

-- Only an upload that never made it into an entry can be removed (the app
-- tidies up after a failed save). No updates: a file is never replaced.
create policy transaction_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'transaction-files'
    and private.in_own_masjid_folder(name)
    and (select private.has_role('bendahari'))
    and not private.attachment_in_use(name));
