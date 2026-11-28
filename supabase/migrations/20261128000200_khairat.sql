-- Step 9: khairat membership and arrears. Standard plan and above.
-- A yearly setup (fee, who is covered, last day to pay, fund), households
-- enrolled per year, and payments that go through the cash book. What a
-- household has paid always matches the ledger: it moves only with entries.

-- Plan gate -------------------------------------------------------------------

-- True when the caller's masjid is on a plan that includes khairat.
create function private.khairat_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.masjids m where m.id = private.current_masjid_id() and m.plan <> 'asas'
  );
$$;

revoke all on function private.khairat_allowed() from public, anon;
grant execute on function private.khairat_allowed() to authenticated, service_role;

-- Yearly setup ------------------------------------------------------------------

alter table public.khairat_plans
  add column coverage text not null default 'household' check (coverage in ('household', 'person')),
  add column pay_by date,
  add column fund_id uuid;

-- Existing setups: last day to pay 31 March, payments into the khairat fund
-- (or the first fund if there is none).
update public.khairat_plans p
set pay_by = make_date(p.year, 3, 31),
    fund_id = coalesce(
      (select f.id from public.funds f where f.masjid_id = p.masjid_id and f.name ilike 'khairat%' order by f.created_at limit 1),
      (select f.id from public.funds f where f.masjid_id = p.masjid_id order by f.created_at limit 1)
    );

alter table public.khairat_plans
  alter column pay_by set not null,
  alter column fund_id set not null,
  add constraint khairat_plans_pay_by_in_year check (extract(year from pay_by) = year),
  add constraint khairat_plans_fund foreign key (masjid_id, fund_id)
    references public.funds (masjid_id, id) on delete restrict;

-- Setting the fee: Pengerusi and Bendahari, paid plans only.
drop policy khairat_plans_insert on public.khairat_plans;
drop policy khairat_plans_update on public.khairat_plans;
create policy khairat_plans_insert on public.khairat_plans for insert to authenticated
  with check (masjid_id = (select private.current_masjid_id())
    and (select private.has_role('pengerusi', 'bendahari'))
    and (select private.khairat_allowed()));
create policy khairat_plans_update on public.khairat_plans for update to authenticated
  using (masjid_id = (select private.current_masjid_id())
    and (select private.has_role('pengerusi', 'bendahari'))
    and (select private.khairat_allowed()))
  with check (masjid_id = (select private.current_masjid_id()));

-- The year of a setup never changes; members and payments hang off it.
create function private.guard_khairat_plan()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.year <> old.year or new.masjid_id <> old.masjid_id then
    raise exception 'khairat: the year of a setup cannot change';
  end if;
  return new;
end;
$$;

create trigger guard_khairat_plan before update on public.khairat_plans
  for each row execute function private.guard_khairat_plan();

-- Members -------------------------------------------------------------------------

-- Status (aktif / tunggakan) is worked out from fee, paid and the last day
-- to pay (lib/khairat.ts); only "tamat" is recorded, with a reason.
alter table public.khairat_members drop column status;
alter table public.khairat_members
  add column people integer not null default 1 check (people between 1 and 100),
  add column ended_at timestamptz,
  add column end_reason text check (end_reason is null or length(end_reason) <= 300),
  add column ended_by uuid references auth.users (id) on delete restrict,
  add constraint khairat_members_end_complete check ((ended_at is null) = (end_reason is null));

-- Members change only through the functions below.
drop policy khairat_members_insert on public.khairat_members;
drop policy khairat_members_update on public.khairat_members;
revoke insert, update on public.khairat_members from authenticated;

-- Payments link to the enrolment they pay for ------------------------------------

alter table public.khairat_members add constraint khairat_members_masjid_row unique (masjid_id, id);
alter table public.transactions add column khairat_member_id uuid;
alter table public.transactions add constraint transactions_khairat_member foreign key (masjid_id, khairat_member_id)
  references public.khairat_members (masjid_id, id) on delete restrict;
alter table public.transactions add constraint transactions_khairat_is_receipt
  check (khairat_member_id is null or (direction = 'in' and reverses_id is null));
create index transactions_khairat_member_idx on public.transactions (khairat_member_id)
  where khairat_member_id is not null;
-- The column stays out of the app's insert grant: only record_khairat_payment sets it.

-- A payment adds to what the household has paid; cancelling it takes it off.
create function private.khairat_paid_follows_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  original public.transactions;
begin
  if new.khairat_member_id is not null then
    update public.khairat_members set paid_sen = paid_sen + new.amount_sen
    where id = new.khairat_member_id and masjid_id = new.masjid_id;
  elsif new.reverses_id is not null then
    select * into original from public.transactions t where t.id = new.reverses_id and t.masjid_id = new.masjid_id;
    if found and original.khairat_member_id is not null then
      update public.khairat_members set paid_sen = paid_sen - original.amount_sen
      where id = original.khairat_member_id and masjid_id = new.masjid_id;
    end if;
  end if;
  return null;
end;
$$;

revoke all on function private.khairat_paid_follows_ledger() from public, anon, authenticated;

create trigger khairat_paid_follows_ledger after insert on public.transactions
  for each row execute function private.khairat_paid_follows_ledger();

-- Functions -----------------------------------------------------------------------

create function private.require_khairat_writer()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  masjid uuid := private.current_masjid_id();
begin
  if auth.uid() is null or masjid is null or not private.has_role('bendahari', 'setiausaha') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not private.khairat_allowed() then
    raise exception 'khairat: not on this plan' using errcode = '42501';
  end if;
  return masjid;
end;
$$;

revoke all on function private.require_khairat_writer() from public, anon, authenticated;

-- Enrols households for a year. Already enrolled ones are skipped. Per-person
-- setups count the people listed under the household (at least 1). Returns
-- how many were added.
create function public.enrol_khairat(p_year integer, p_household_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  masjid uuid := private.require_khairat_writer();
  setup public.khairat_plans;
  added integer;
begin
  select * into setup from public.khairat_plans where masjid_id = masjid and year = p_year;
  if not found then
    raise exception 'khairat: no setup for this year';
  end if;
  if coalesce(array_length(p_household_ids, 1), 0) > 2000 then
    raise exception 'khairat: too many at once';
  end if;

  insert into public.khairat_members (masjid_id, household_id, plan_id, people)
  select masjid, h.id, setup.id,
    case when setup.coverage = 'person'
      then greatest(1, (select count(*) from public.members m where m.masjid_id = masjid and m.household_id = h.id))::integer
      else 1 end
  from public.households h
  where h.masjid_id = masjid and h.id = any (p_household_ids)
  on conflict (masjid_id, household_id, plan_id) do nothing;

  get diagnostics added = row_count;
  return added;
end;
$$;

-- Enrols everyone who was a member last year and did not end.
create function public.renew_khairat(p_year integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  masjid uuid := private.require_khairat_writer();
  ids uuid[];
begin
  select coalesce(array_agg(km.household_id), '{}') into ids
  from public.khairat_members km
  join public.khairat_plans p on p.id = km.plan_id and p.masjid_id = km.masjid_id
  where km.masjid_id = masjid and p.year = p_year - 1 and km.ended_at is null;

  return public.enrol_khairat(p_year, ids);
end;
$$;

-- Ends a membership (moved away, passed away) with a reason. It stays on record.
create function public.end_khairat(p_member_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  masjid uuid := private.require_khairat_writer();
begin
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'khairat: a reason is required';
  end if;
  if length(p_reason) > 300 then
    raise exception 'khairat: the reason is too long';
  end if;

  update public.khairat_members
  set ended_at = now(), end_reason = trim(p_reason), ended_by = auth.uid()
  where id = p_member_id and masjid_id = masjid and ended_at is null;
  if not found then
    raise exception 'khairat: member not found or already ended';
  end if;
end;
$$;

-- Records a khairat payment: a receipt in the setup's fund, category
-- "Khairat", linked to the household and the year it pays for. The receipt
-- number and the paid amount follow from the entry (triggers). A payment
-- may not be more than what is still owed for that year.
create function public.record_khairat_payment(
  p_member_id uuid,
  p_amount_sen bigint,
  p_date date,
  p_method text,
  p_ref_no text default null,
  p_received_from text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  masjid uuid := private.require_khairat_writer();
  member public.khairat_members;
  setup public.khairat_plans;
  head text;
  category uuid;
  posted uuid;
  owed bigint;
begin
  select * into member from public.khairat_members where id = p_member_id and masjid_id = masjid for update;
  if not found then
    raise exception 'khairat: member not found';
  end if;
  if member.ended_at is not null then
    raise exception 'khairat: this membership has ended';
  end if;
  select * into setup from public.khairat_plans where id = member.plan_id and masjid_id = masjid;

  owed := setup.fee_sen * member.people - member.paid_sen;
  if p_amount_sen is null or p_amount_sen <= 0 then
    raise exception 'khairat: the amount must be more than zero';
  end if;
  if p_amount_sen > owed then
    raise exception 'khairat: more than what is owed for %', setup.year;
  end if;
  if p_ref_no is not null and length(p_ref_no) > 60 then
    raise exception 'khairat: the reference is too long';
  end if;

  select h.head_name into head from public.households h where h.id = member.household_id and h.masjid_id = masjid;
  select k.id into category from public.categories k
  where k.masjid_id = masjid and k.name = 'Khairat' and k.type = 'income' and k.archived_at is null
  order by k.created_at
  limit 1;

  insert into public.transactions (
    masjid_id, fund_id, category_id, amount_sen, direction, date, method, ref_no, note,
    household_id, received_from, khairat_member_id, created_by
  )
  values (
    masjid, setup.fund_id, category, p_amount_sen, 'in', p_date, p_method, nullif(trim(p_ref_no), ''),
    'Yuran khairat ' || setup.year, member.household_id,
    left(coalesce(nullif(trim(p_received_from), ''), head), 100), member.id, auth.uid()
  )
  returning id into posted;

  return posted;
end;
$$;

revoke all on function public.enrol_khairat(integer, uuid[]) from public, anon;
revoke all on function public.renew_khairat(integer) from public, anon;
revoke all on function public.end_khairat(uuid, text) from public, anon;
revoke all on function public.record_khairat_payment(uuid, bigint, date, text, text, text) from public, anon;
grant execute on function public.enrol_khairat(integer, uuid[]) to authenticated;
grant execute on function public.renew_khairat(integer) to authenticated;
grant execute on function public.end_khairat(uuid, text) to authenticated;
grant execute on function public.record_khairat_payment(uuid, bigint, date, text, text, text) to authenticated;
