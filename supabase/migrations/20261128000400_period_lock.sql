-- Step 11: locking and unlocking months from the app, and reports that go out
-- of date when a month is unlocked. The rule that nothing dated in a locked
-- month can change (reject_locked_month, Step 2) already holds for every role
-- and the service role.

-- Reports ------------------------------------------------------------------------

-- Set when the month (or the year) a report covers is unlocked. A new report
-- made afterwards (Step 12) is a new row, so it is valid again.
alter table public.reports add column invalidated_at timestamptz;

-- Locking and unlocking only through the functions below ------------------------

drop policy periods_insert on public.periods;
drop policy periods_update on public.periods;
revoke insert, update on public.periods from authenticated;

-- Unlocking marks that month's reports, and that year's yearly reports, as no
-- longer valid. A trigger, so it also happens for an unlock by the service role.
create function private.invalidate_reports_on_unlock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.locked_at is not null and new.locked_at is null then
    update public.reports r
    set invalidated_at = now()
    where r.masjid_id = new.masjid_id
      and r.invalidated_at is null
      and r.period in (to_char(new.month, 'YYYY-MM'), to_char(new.month, 'YYYY'));
  end if;
  return null;
end;
$$;

revoke all on function private.invalidate_reports_on_unlock() from public, anon, authenticated;

create trigger invalidate_reports_on_unlock after update on public.periods
  for each row execute function private.invalidate_reports_on_unlock();

create function private.require_pengerusi()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  masjid uuid := private.current_masjid_id();
begin
  if auth.uid() is null or masjid is null or not private.has_role('pengerusi') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return masjid;
end;
$$;

revoke all on function private.require_pengerusi() from public, anon, authenticated;

-- Locks a month that has ended (Malaysia time). Refused while a Friday
-- collection in it is not confirmed or is waiting for a recount: once locked,
-- it could never be confirmed. Who and when are recorded by guard_period.
create function public.lock_month(p_month date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  masjid uuid := private.require_pengerusi();
  this_month date := date_trunc('month', (now() at time zone 'Asia/Kuala_Lumpur'))::date;
  period public.periods;
begin
  if p_month is null or extract(day from p_month) <> 1 then
    raise exception 'periods: not the first day of a month';
  end if;
  if p_month >= this_month then
    raise exception 'periods: month has not ended';
  end if;
  if exists (
    select 1 from public.collections c
    where c.masjid_id = masjid
      and c.date >= p_month and c.date < (p_month + interval '1 month')::date
      and c.status in ('counted', 'needs_review')
  ) then
    raise exception 'periods: pending collections';
  end if;

  select * into period from public.periods where masjid_id = masjid and month = p_month for update;
  if found and period.locked_at is not null then
    raise exception 'periods: already locked';
  end if;

  if found then
    update public.periods set locked_at = now() where id = period.id;
  else
    insert into public.periods (masjid_id, month, locked_at) values (masjid, p_month, now());
  end if;
end;
$$;

-- Unlocks a month with a reason. The reason and who did it are in the audit log.
create function public.unlock_month(p_month date, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  masjid uuid := private.require_pengerusi();
  reason text := trim(coalesce(p_reason, ''));
begin
  if length(reason) = 0 then
    raise exception 'periods: unlocking a month needs a reason';
  end if;
  if length(reason) > 300 then
    raise exception 'periods: the reason is too long';
  end if;

  update public.periods
  set locked_at = null, unlock_reason = reason
  where masjid_id = masjid and month = p_month and locked_at is not null;
  if not found then
    raise exception 'periods: month is not locked';
  end if;
end;
$$;

revoke all on function public.lock_month(date) from public, anon;
revoke all on function public.unlock_month(date, text) from public, anon;
grant execute on function public.lock_month(date) to authenticated;
grant execute on function public.unlock_month(date, text) to authenticated;
