-- Step 10: DuitNow QR display, bank statement import, matching and the
-- monthly reconciliation. The system only reads statements the Bendahari
-- uploads; it never holds bank logins and never moves money.

-- DuitNow QR ------------------------------------------------------------------------

-- The QR's text (EMVCo payload) is checked in the app before it is saved; the
-- masjid row keeps only the text, never the picture.
alter table public.masjids
  add column receipt_show_qr boolean not null default false,
  add constraint masjids_duitnow_payload_length
    check (duitnow_payload is null or length(duitnow_payload) between 20 and 512);
grant update (receipt_show_qr) on public.masjids to authenticated;

-- Saved column choices, one per bank -----------------------------------------------

-- Columns are kept by their header text, so the header row is found again in
-- the next file even if the bank adds lines above it.
create table public.bank_formats (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null default private.current_masjid_id()
    references public.masjids (id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 60),
  date_column text not null check (length(date_column) between 1 and 100),
  description_columns text[] not null check (cardinality(description_columns) between 1 and 3),
  debit_column text check (length(debit_column) between 1 and 100),
  credit_column text check (length(credit_column) between 1 and 100),
  amount_column text check (length(amount_column) between 1 and 100),
  date_order text not null default 'dmy' check (date_order in ('dmy', 'ymd', 'mdy')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (masjid_id, id),
  unique (masjid_id, name),
  -- Either one signed amount column, or separate debit and credit columns.
  check (
    (amount_column is not null and debit_column is null and credit_column is null)
    or (amount_column is null and debit_column is not null and credit_column is not null)
  )
);

create trigger set_updated_at before update on public.bank_formats
  for each row execute function private.set_updated_at();
create trigger audit_row after insert or update or delete on public.bank_formats
  for each row execute function private.audit_row();

alter table public.bank_formats enable row level security;
grant select, insert, update, delete on public.bank_formats to authenticated;
create policy bank_formats_select on public.bank_formats for select to authenticated
  using (masjid_id = (select private.current_masjid_id()) and (select private.has_role('pengerusi', 'bendahari')));
create policy bank_formats_insert on public.bank_formats for insert to authenticated
  with check (masjid_id = (select private.current_masjid_id()) and (select private.has_role('bendahari')));
create policy bank_formats_update on public.bank_formats for update to authenticated
  using (masjid_id = (select private.current_masjid_id()) and (select private.has_role('bendahari')))
  with check (masjid_id = (select private.current_masjid_id()));
create policy bank_formats_delete on public.bank_formats for delete to authenticated
  using (masjid_id = (select private.current_masjid_id()) and (select private.has_role('bendahari')));

-- One row per uploaded file ---------------------------------------------------------

create table public.bank_imports (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null default private.current_masjid_id()
    references public.masjids (id) on delete restrict,
  format_id uuid,
  file_name text not null check (length(file_name) between 1 and 200),
  lines_added integer not null default 0 check (lines_added >= 0),
  lines_skipped integer not null default 0 check (lines_skipped >= 0),
  first_date date,
  last_date date,
  imported_by uuid not null references auth.users (id) on delete restrict,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (masjid_id, id),
  check ((cancelled_at is null) = (cancelled_by is null)),
  foreign key (masjid_id, format_id)
    references public.bank_formats (masjid_id, id) on delete set null (format_id)
);

create index bank_imports_masjid_created_idx on public.bank_imports (masjid_id, created_at desc);

create trigger set_updated_at before update on public.bank_imports
  for each row execute function private.set_updated_at();
-- File names can carry an account number or a name.
create trigger audit_row after insert or update or delete on public.bank_imports
  for each row execute function private.audit_row('file_name');

alter table public.bank_imports enable row level security;
grant select on public.bank_imports to authenticated;
create policy bank_imports_select on public.bank_imports for select to authenticated
  using (masjid_id = (select private.current_masjid_id()) and (select private.has_role('pengerusi', 'bendahari')));
-- Written only by the functions below.

-- Bank lines ------------------------------------------------------------------------

-- amount_sen stays signed: money in (credit) is positive, money out (debit)
-- negative. line_hash is the duplicate fingerprint (lib/bank-import.ts).
-- cash_transfer: a cash deposit or cash withdrawal, already in the ledger as
-- the cash entry, so it needs no entry of its own.
alter table public.bank_lines
  add column import_id uuid,
  -- Lines from before Step 10 get a fingerprint that can never collide. (Set
  -- as the column is added, so the locked-month rule is not involved.)
  add column line_hash text not null default ('lama-' || gen_random_uuid()::text),
  add column cash_transfer boolean not null default false,
  add column rejected_ids uuid[] not null default '{}',
  add constraint bank_lines_import foreign key (masjid_id, import_id)
    references public.bank_imports (masjid_id, id) on delete restrict;

alter table public.bank_lines
  alter column line_hash drop default,
  add constraint bank_lines_hash_unique unique (masjid_id, line_hash),
  add constraint bank_lines_description_length check (description is null or length(description) <= 300),
  add constraint bank_lines_one_explanation check (not (cash_transfer and matched_transaction_id is not null)),
  add constraint bank_lines_rejected_limit check (cardinality(rejected_ids) <= 50);

create unique index bank_lines_one_per_transaction on public.bank_lines (masjid_id, matched_transaction_id)
  where matched_transaction_id is not null;

-- Lines change only through the functions below, which check every rule.
drop policy bank_lines_insert on public.bank_lines;
drop policy bank_lines_update on public.bank_lines;
drop policy bank_lines_delete on public.bank_lines;
revoke insert, update, delete on public.bank_lines from authenticated;

-- A cancelled entry no longer explains a bank line: its match is removed,
-- unless the line sits in a locked month (the screen then shows it as
-- needing attention instead).
create function private.unmatch_reversed_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reverses_id is not null then
    update public.bank_lines b
    set matched_transaction_id = null
    where b.masjid_id = new.masjid_id
      and b.matched_transaction_id = new.reverses_id
      and not exists (
        select 1 from public.periods p
        where p.masjid_id = b.masjid_id
          and p.month = date_trunc('month', b.date::timestamp)::date
          and p.locked_at is not null
      );
  end if;
  return null;
end;
$$;

revoke all on function private.unmatch_reversed_entry() from public, anon, authenticated;

create trigger unmatch_reversed_entry after insert on public.transactions
  for each row execute function private.unmatch_reversed_entry();

-- Functions -------------------------------------------------------------------------

create function private.require_bank_writer()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  masjid uuid := private.current_masjid_id();
begin
  if auth.uid() is null or masjid is null or not private.has_role('bendahari') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return masjid;
end;
$$;

revoke all on function private.require_bank_writer() from public, anon, authenticated;

-- The lines sent by the app, one per fingerprint.
create function private.bank_incoming(p_lines jsonb)
returns table (date date, amount_sen bigint, description text, hash text)
language sql
immutable
set search_path = ''
as $$
  select distinct on (l.hash) l.date, l.amount_sen, nullif(trim(l.description), ''), l.hash
  from jsonb_to_recordset(p_lines) as l (date date, amount_sen bigint, description text, hash text)
  order by l.hash;
$$;

revoke all on function private.bank_incoming(jsonb) from public, anon, authenticated;

-- Adds a statement's lines. Lines already imported (same fingerprint) are
-- skipped. When nothing is new, no import is recorded. A line dated in a
-- locked month stops the whole import (the preview leaves those out).
create function public.import_bank_lines(p_format_id uuid, p_file_name text, p_lines jsonb)
returns table (import_id uuid, added integer, skipped integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  masjid uuid := private.require_bank_writer();
  total integer;
  fresh integer;
  new_id uuid;
begin
  if jsonb_typeof(p_lines) <> 'array' then
    raise exception 'bank: lines must be a list';
  end if;
  total := jsonb_array_length(p_lines);
  if total = 0 then
    raise exception 'bank: no lines';
  end if;
  if total > 5000 then
    raise exception 'bank: too many lines';
  end if;
  if length(trim(coalesce(p_file_name, ''))) = 0 or length(p_file_name) > 200 then
    raise exception 'bank: file name missing or too long';
  end if;
  if p_format_id is not null and not exists (
    select 1 from public.bank_formats f where f.id = p_format_id and f.masjid_id = masjid
  ) then
    raise exception 'bank: format not found';
  end if;

  if exists (
    select 1 from private.bank_incoming(p_lines) i
    where i.date is null or i.amount_sen is null or i.amount_sen = 0 or abs(i.amount_sen) > 100000000000
      or i.hash is null or i.hash !~ '^[0-9a-f]{64}$' or length(i.description) > 300
  ) then
    raise exception 'bank: a line is not valid';
  end if;

  select count(*) into fresh
  from private.bank_incoming(p_lines) i
  where not exists (select 1 from public.bank_lines b where b.masjid_id = masjid and b.line_hash = i.hash);

  if fresh = 0 then
    return query select null::uuid, 0, total;
    return;
  end if;

  insert into public.bank_imports (masjid_id, format_id, file_name, lines_added, lines_skipped, first_date, last_date, imported_by)
  select masjid, p_format_id, trim(p_file_name), fresh, total - fresh, min(i.date), max(i.date), auth.uid()
  from private.bank_incoming(p_lines) i
  where not exists (select 1 from public.bank_lines b where b.masjid_id = masjid and b.line_hash = i.hash)
  returning id into new_id;

  insert into public.bank_lines (masjid_id, date, amount_sen, description, import_id, line_hash)
  select masjid, i.date, i.amount_sen, i.description, new_id, i.hash
  from private.bank_incoming(p_lines) i
  on conflict (masjid_id, line_hash) do nothing;

  return query select new_id, fresh, total - fresh;
end;
$$;

-- Takes a whole file back out, for a wrong column choice. Only while none of
-- its lines is matched or marked as cash, and none is in a locked month.
create function public.cancel_bank_import(p_import_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  masjid uuid := private.require_bank_writer();
begin
  perform 1 from public.bank_imports i
  where i.id = p_import_id and i.masjid_id = masjid and i.cancelled_at is null
  for update;
  if not found then
    raise exception 'bank: import not found or already cancelled';
  end if;
  if exists (
    select 1 from public.bank_lines b
    where b.masjid_id = masjid and b.import_id = p_import_id
      and (b.matched_transaction_id is not null or b.cash_transfer)
  ) then
    raise exception 'bank: import has matched lines';
  end if;

  delete from public.bank_lines b where b.masjid_id = masjid and b.import_id = p_import_id;
  update public.bank_imports
  set cancelled_at = now(), cancelled_by = auth.uid()
  where id = p_import_id and masjid_id = masjid;
end;
$$;

-- Links a bank line to the ledger entry it is. Same masjid, same amount and
-- direction, a bank method (not cash), not cancelled, and each side used once.
create function public.match_bank_line(p_line_id uuid, p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  masjid uuid := private.require_bank_writer();
  line public.bank_lines;
  entry public.transactions;
begin
  select * into line from public.bank_lines where id = p_line_id and masjid_id = masjid for update;
  if not found then
    raise exception 'bank: line not found';
  end if;
  if line.matched_transaction_id is not null or line.cash_transfer then
    raise exception 'bank: line already explained';
  end if;

  select * into entry from public.transactions where id = p_transaction_id and masjid_id = masjid;
  if not found then
    raise exception 'bank: entry not found';
  end if;
  if entry.reverses_id is not null
    or exists (select 1 from public.transactions r where r.masjid_id = masjid and r.reverses_id = entry.id) then
    raise exception 'bank: entry is cancelled';
  end if;
  if entry.method = 'cash' then
    raise exception 'bank: cash entries do not go through the bank';
  end if;
  if (case when entry.direction = 'in' then entry.amount_sen else -entry.amount_sen end) <> line.amount_sen then
    raise exception 'bank: amount does not match';
  end if;
  if exists (
    select 1 from public.bank_lines b where b.masjid_id = masjid and b.matched_transaction_id = entry.id
  ) then
    raise exception 'bank: entry already matched';
  end if;

  update public.bank_lines
  set matched_transaction_id = entry.id, rejected_ids = array_remove(rejected_ids, entry.id)
  where id = line.id;
end;
$$;

-- Marks a line as cash going into or out of the bank.
create function public.mark_bank_cash(p_line_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  masjid uuid := private.require_bank_writer();
begin
  update public.bank_lines
  set cash_transfer = true
  where id = p_line_id and masjid_id = masjid and matched_transaction_id is null and not cash_transfer;
  if not found then
    raise exception 'bank: line not found or already explained';
  end if;
end;
$$;

-- Undoes a match or a cash mark.
create function public.clear_bank_line(p_line_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  masjid uuid := private.require_bank_writer();
begin
  update public.bank_lines
  set matched_transaction_id = null, cash_transfer = false
  where id = p_line_id and masjid_id = masjid and (matched_transaction_id is not null or cash_transfer);
  if not found then
    raise exception 'bank: line not found or not explained';
  end if;
end;
$$;

-- Remembers that the Bendahari said "not this one", so it is not suggested again.
create function public.reject_bank_suggestion(p_line_id uuid, p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  masjid uuid := private.require_bank_writer();
begin
  update public.bank_lines
  set rejected_ids = case
    when p_transaction_id = any (rejected_ids) then rejected_ids
    else (rejected_ids || p_transaction_id)[greatest(1, cardinality(rejected_ids) - 48):]
  end
  where id = p_line_id and masjid_id = masjid;
  if not found then
    raise exception 'bank: line not found';
  end if;
end;
$$;

revoke all on function public.import_bank_lines(uuid, text, jsonb) from public, anon;
revoke all on function public.cancel_bank_import(uuid) from public, anon;
revoke all on function public.match_bank_line(uuid, uuid) from public, anon;
revoke all on function public.mark_bank_cash(uuid) from public, anon;
revoke all on function public.clear_bank_line(uuid) from public, anon;
revoke all on function public.reject_bank_suggestion(uuid, uuid) from public, anon;
grant execute on function public.import_bank_lines(uuid, text, jsonb) to authenticated;
grant execute on function public.cancel_bank_import(uuid) to authenticated;
grant execute on function public.match_bank_line(uuid, uuid) to authenticated;
grant execute on function public.mark_bank_cash(uuid) to authenticated;
grant execute on function public.clear_bank_line(uuid) to authenticated;
grant execute on function public.reject_bank_suggestion(uuid, uuid) to authenticated;
