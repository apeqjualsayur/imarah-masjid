-- Step 7: Friday collections counted by one person and confirmed by another.
-- Every change goes through the functions below; the table cannot be written
-- directly by app users. On confirmation the receipt is posted to the cash
-- book with a gapless receipt number.

-- Collections ---------------------------------------------------------------

alter table public.collections
  add column status text not null default 'counted'
    check (status in ('counted', 'needs_review', 'confirmed', 'void')),
  add column breakdown jsonb check (breakdown is null or jsonb_typeof(breakdown) = 'object'),
  add column note text check (note is null or length(note) <= 500),
  -- Made on the phone when the form opens, so a count sent twice is saved once.
  add column client_key uuid,
  -- The confirmer's own figure when it did not match the count.
  add column check_total_sen bigint check (check_total_sen is null or check_total_sen > 0),
  add column checked_by uuid references auth.users (id) on delete restrict,
  add column confirmed_at timestamptz,
  add column void_reason text check (void_reason is null or length(void_reason) <= 300),
  add column voided_by uuid references auth.users (id) on delete restrict;

alter table public.collections add constraint collections_one_per_key unique (masjid_id, client_key);

-- Counts confirmed before Step 7 keep their state.
update public.collections set status = 'confirmed', confirmed_at = updated_at
where confirmed_by is not null;

-- Rules that hold for everyone, including the secret key. Replaces the Step 2 guard.
create or replace function private.guard_collection()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('confirmed', 'void') then
    raise exception 'collections: a confirmed or cancelled count cannot be changed';
  end if;
  if old.confirmed_by is not null and new.confirmed_by is distinct from old.confirmed_by then
    raise exception 'collections: confirmation cannot be changed';
  end if;
  if new.masjid_id <> old.masjid_id or new.client_key is distinct from old.client_key then
    raise exception 'collections: masjid and key cannot change';
  end if;
  if new.status = 'confirmed' and (new.confirmed_by is null or new.transaction_id is null) then
    raise exception 'collections: a confirmed count needs its confirmer and its ledger entry';
  end if;
  if new.checked_by is not null and new.checked_by = new.counted_by then
    raise exception 'collections: the counter cannot check their own count';
  end if;
  return new;
end;
$$;

create trigger guard_collection_delete before delete on public.collections
  for each row execute function private.reject_change();

-- Only the functions write. Reading stays as before (P, B, S, AJK).
drop policy collections_insert on public.collections;
drop policy collections_confirm on public.collections;
revoke insert, update, delete on public.collections from authenticated;

-- Receipt numbers --------------------------------------------------------------

alter table public.transactions add column receipt_no text;
alter table public.transactions add constraint transactions_receipt_no_unique unique (masjid_id, receipt_no);
alter table public.transactions add constraint transactions_receipt_no_format
  check (receipt_no is null or receipt_no ~ '^RC-[0-9]{4}-[0-9]{4,}$');

-- App users may set every column except the receipt number, which only the
-- system issues.
revoke insert on public.transactions from authenticated;
grant insert (
  id, masjid_id, fund_id, category_id, amount_sen, direction, date, ref_no, method, status,
  reverses_id, household_id, created_by, note, reversal_reason, attachment_path
) on public.transactions to authenticated;

-- The next number for a masjid and year, e.g. RC-2026-0001. The counter row
-- is locked by the update, so two receipts at the same moment never share a
-- number, and a number is used even if its entry is later cancelled.
create function private.next_receipt_no(p_masjid_id uuid, p_year integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  insert into public.receipt_counters (masjid_id, year, last_no)
  values (p_masjid_id, p_year, 1)
  on conflict (masjid_id, year) do update set last_no = public.receipt_counters.last_no + 1
  returning last_no into n;

  return 'RC-' || p_year::text || '-' || lpad(n::text, 4, '0');
end;
$$;

revoke all on function private.next_receipt_no(uuid, integer) from public, anon, authenticated;

-- Functions ---------------------------------------------------------------

-- Checks a breakdown {"100": 3, "50": 0, ..., "coins_sen": 450} and returns
-- its total in sen. Notes are counted by number; coins as one sen amount.
create function private.breakdown_total(p_breakdown jsonb)
returns bigint
language plpgsql
immutable
set search_path = ''
as $$
declare
  item record;
  total bigint := 0;
  n numeric;
begin
  for item in select key, value from jsonb_each(p_breakdown) loop
    if jsonb_typeof(item.value) <> 'number' then
      raise exception 'collection: breakdown values must be numbers';
    end if;
    n := (item.value #>> '{}')::numeric;
    if n < 0 or n <> trunc(n) or n > 100000000 then
      raise exception 'collection: breakdown values must be whole and not negative';
    end if;
    if item.key = 'coins_sen' then
      total := total + n::bigint;
    elsif item.key in ('100', '50', '20', '10', '5', '1') then
      total := total + n::bigint * item.key::bigint * 100;
    else
      raise exception 'collection: unknown note %', item.key;
    end if;
  end loop;
  return total;
end;
$$;

revoke all on function private.breakdown_total(jsonb) from public, anon, authenticated;

create function private.check_count(p_date date, p_fund_id uuid, p_total_sen bigint, p_breakdown jsonb, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_total_sen is null or p_total_sen <= 0 or p_total_sen > 1000000000 then
    raise exception 'collection: the amount must be more than zero';
  end if;
  if p_date is null or p_date > (now() at time zone 'Asia/Kuala_Lumpur')::date then
    raise exception 'collection: the date is in the future';
  end if;
  if not exists (
    select 1 from public.funds f
    where f.id = p_fund_id and f.masjid_id = private.current_masjid_id() and f.archived_at is null
  ) then
    raise exception 'collection: choose an open fund';
  end if;
  if p_breakdown is not null and private.breakdown_total(p_breakdown) <> p_total_sen then
    raise exception 'collection: the breakdown does not add up to the amount';
  end if;
  if p_note is not null and length(p_note) > 500 then
    raise exception 'collection: the note is too long';
  end if;
end;
$$;

revoke all on function private.check_count(date, uuid, bigint, jsonb, text) from public, anon, authenticated;

-- Saves a count. Sending the same key again returns the first count's id and
-- saves nothing new.
create function public.record_collection(
  p_key uuid,
  p_date date,
  p_fund_id uuid,
  p_total_sen bigint,
  p_breakdown jsonb default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  masjid uuid := private.current_masjid_id();
  saved uuid;
begin
  if uid is null or masjid is null or not private.has_role('bendahari', 'ajk') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_key is null then
    raise exception 'collection: a key is required';
  end if;

  select c.id into saved from public.collections c where c.masjid_id = masjid and c.client_key = p_key;
  if found then
    return saved;
  end if;

  perform private.check_count(p_date, p_fund_id, p_total_sen, p_breakdown, nullif(trim(p_note), ''));

  insert into public.collections (masjid_id, date, fund_id, total_sen, counted_by, breakdown, note, client_key)
  values (masjid, p_date, p_fund_id, p_total_sen, uid, p_breakdown, nullif(trim(p_note), ''), p_key)
  on conflict (masjid_id, client_key) do nothing
  returning id into saved;

  -- Two sends at the same moment: the other one saved it.
  if saved is null then
    select c.id into saved from public.collections c where c.masjid_id = masjid and c.client_key = p_key;
  end if;
  return saved;
end;
$$;

-- A different person enters their own count. If it matches, the receipt is
-- posted to the cash book with a receipt number; if not, the count is marked
-- for checking and nothing is posted. Confirming again returns 'confirmed'
-- without posting twice.
create function public.confirm_collection(p_id uuid, p_total_sen bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  masjid uuid := private.current_masjid_id();
  c public.collections;
  category uuid;
  receipt text;
  posted uuid;
begin
  if uid is null or masjid is null or not private.has_role('pengerusi', 'bendahari', 'ajk') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select * into c from public.collections where id = p_id and masjid_id = masjid for update;
  if not found then
    raise exception 'collection: not found';
  end if;
  if c.status = 'confirmed' then
    return 'confirmed';
  end if;
  if c.status = 'void' then
    raise exception 'collection: this count was cancelled';
  end if;
  if c.counted_by = uid then
    raise exception 'collection: you cannot confirm your own count' using errcode = '42501';
  end if;
  if c.status = 'needs_review' then
    raise exception 'collection: recount first';
  end if;
  if p_total_sen is null or p_total_sen <= 0 then
    raise exception 'collection: the amount must be more than zero';
  end if;

  if p_total_sen <> c.total_sen then
    update public.collections
    set status = 'needs_review', check_total_sen = p_total_sen, checked_by = uid
    where id = c.id;
    return 'needs_review';
  end if;

  select k.id into category from public.categories k
  where k.masjid_id = masjid and k.name = 'Kutipan Jumaat' and k.type = 'income' and k.archived_at is null
  order by k.created_at
  limit 1;

  receipt := private.next_receipt_no(masjid, extract(year from c.date)::integer);

  insert into public.transactions (masjid_id, fund_id, category_id, amount_sen, direction, date, method, note, receipt_no, created_by)
  values (masjid, c.fund_id, category, c.total_sen, 'in', c.date, 'cash', c.note, receipt, uid)
  returning id into posted;

  update public.collections
  set status = 'confirmed', confirmed_by = uid, confirmed_at = now(), transaction_id = posted
  where id = c.id;

  return 'confirmed';
end;
$$;

-- A fresh count, for a count marked for checking or one that was wrong before
-- anyone confirmed it. The person recounting becomes the counter, so someone
-- else must confirm.
create function public.recount_collection(p_id uuid, p_total_sen bigint, p_breakdown jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  masjid uuid := private.current_masjid_id();
  c public.collections;
begin
  if uid is null or masjid is null or not private.has_role('bendahari', 'ajk') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select * into c from public.collections where id = p_id and masjid_id = masjid for update;
  if not found then
    raise exception 'collection: not found';
  end if;
  if c.status not in ('counted', 'needs_review') then
    raise exception 'collection: a confirmed or cancelled count cannot be changed';
  end if;

  perform private.check_count(c.date, c.fund_id, p_total_sen, p_breakdown, c.note);

  update public.collections
  set total_sen = p_total_sen, breakdown = p_breakdown, counted_by = uid,
      status = 'counted', check_total_sen = null, checked_by = null
  where id = c.id;
end;
$$;

-- Cancels a count entered by mistake, before it is confirmed. The row stays.
create function public.cancel_collection(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  masjid uuid := private.current_masjid_id();
  c public.collections;
begin
  if uid is null or masjid is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select * into c from public.collections where id = p_id and masjid_id = masjid for update;
  if not found then
    raise exception 'collection: not found';
  end if;
  if not (private.has_role('pengerusi', 'bendahari') or (c.counted_by = uid and private.has_role('ajk'))) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if c.status not in ('counted', 'needs_review') then
    raise exception 'collection: a confirmed or cancelled count cannot be changed';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'collection: a reason is required';
  end if;
  if length(p_reason) > 300 then
    raise exception 'collection: the reason is too long';
  end if;

  update public.collections
  set status = 'void', void_reason = trim(p_reason), voided_by = uid
  where id = c.id;
end;
$$;

revoke all on function public.record_collection(uuid, date, uuid, bigint, jsonb, text) from public, anon;
revoke all on function public.confirm_collection(uuid, bigint) from public, anon;
revoke all on function public.recount_collection(uuid, bigint, jsonb) from public, anon;
revoke all on function public.cancel_collection(uuid, text) from public, anon;
grant execute on function public.record_collection(uuid, date, uuid, bigint, jsonb, text) to authenticated;
grant execute on function public.confirm_collection(uuid, bigint) to authenticated;
grant execute on function public.recount_collection(uuid, bigint, jsonb) to authenticated;
grant execute on function public.cancel_collection(uuid, text) to authenticated;
