-- Rules that hold for everyone, including the service role.

-- Transactions are append-only.
create trigger transactions_no_change before update or delete on public.transactions
  for each row execute function private.reject_change();
create trigger transactions_no_truncate before truncate on public.transactions
  for each statement execute function private.reject_change();

-- A reversal must exactly undo one original entry.
create function private.check_reversal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  original public.transactions;
begin
  if new.reverses_id is null then
    return new;
  end if;

  select * into original
  from public.transactions
  where id = new.reverses_id and masjid_id = new.masjid_id;

  if not found then
    raise exception 'reversal: original transaction not found';
  end if;
  if original.reverses_id is not null then
    raise exception 'reversal: a reversal cannot itself be reversed';
  end if;
  if new.fund_id <> original.fund_id
    or new.amount_sen <> original.amount_sen
    or new.direction = original.direction then
    raise exception 'reversal: must match the fund and amount and go the opposite way';
  end if;

  return new;
end;
$$;

create trigger check_reversal before insert on public.transactions
  for each row execute function private.check_reversal();

-- Nothing dated inside a locked month can be added, changed or removed, and a
-- row cannot be moved out of one.
create function private.reject_locked_month()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked boolean;
begin
  if tg_op <> 'INSERT' then
    select exists (
      select 1 from public.periods p
      where p.masjid_id = old.masjid_id
        and p.month = date_trunc('month', old.date::timestamp)::date
        and p.locked_at is not null
    ) into locked;

    if locked then
      raise exception 'locked period: % is in a locked month', old.date;
    end if;
  end if;

  if tg_op <> 'DELETE' then
    select exists (
      select 1 from public.periods p
      where p.masjid_id = new.masjid_id
        and p.month = date_trunc('month', new.date::timestamp)::date
        and p.locked_at is not null
    ) into locked;

    if locked then
      raise exception 'locked period: % is in a locked month', new.date;
    end if;
    return new;
  end if;

  return old;
end;
$$;

create trigger reject_locked_month before insert or update or delete on public.transactions
  for each row execute function private.reject_locked_month();
create trigger reject_locked_month before insert or update or delete on public.collections
  for each row execute function private.reject_locked_month();
create trigger reject_locked_month before insert or update or delete on public.bank_lines
  for each row execute function private.reject_locked_month();

-- Locking records who did it. Unlocking needs a fresh reason each time; earlier
-- reasons stay in the audit log.
create function private.guard_period()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'periods: a month record cannot be deleted';
  end if;

  if tg_op = 'UPDATE' and (new.month <> old.month or new.masjid_id <> old.masjid_id) then
    raise exception 'periods: month and masjid cannot change';
  end if;

  if new.locked_at is not null and (tg_op = 'INSERT' or old.locked_at is null) then
    new.locked_by := coalesce(auth.uid(), new.locked_by);
    new.unlock_reason := null;
  end if;

  if tg_op = 'UPDATE' and old.locked_at is not null and new.locked_at is null then
    if length(trim(coalesce(new.unlock_reason, ''))) = 0 then
      raise exception 'periods: unlocking a month needs a reason';
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_period before insert or update or delete on public.periods
  for each row execute function private.guard_period();

-- A confirmed collection stays confirmed by that person.
create function private.guard_collection()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.confirmed_by is not null and new.confirmed_by is distinct from old.confirmed_by then
    raise exception 'collections: confirmation cannot be changed';
  end if;

  return new;
end;
$$;

create trigger guard_collection before update on public.collections
  for each row execute function private.guard_collection();

-- A masjid always keeps at least one active Pengerusi. The masjid row is locked
-- so two people cannot remove each other at the same moment.
create function private.keep_last_pengerusi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role <> 'pengerusi' or old.status <> 'active' then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' and new.role = 'pengerusi' and new.status = 'active' then
    return new;
  end if;

  perform 1 from public.masjids where id = old.masjid_id for update;

  if not exists (
    select 1 from public.memberships m
    where m.masjid_id = old.masjid_id
      and m.role = 'pengerusi'
      and m.status = 'active'
      and m.id <> old.id
  ) then
    raise exception 'memberships: the last Pengerusi cannot be removed';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger keep_last_pengerusi before update or delete on public.memberships
  for each row execute function private.keep_last_pengerusi();
