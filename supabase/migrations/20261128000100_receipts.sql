-- Step 8: e-receipts. Every new receipt (money in, not a cancellation) gets a
-- gapless number per masjid per year in the same database transaction as the
-- entry. Adds the optional donor name and the setting that hides the Imarah
-- credit on paid plans.

-- Donor name -------------------------------------------------------------------

alter table public.transactions add column received_from text;
alter table public.transactions add constraint transactions_received_from_length
  check (received_from is null or length(received_from) <= 100);

-- Only receipts carry a number, and a cancellation never does.
alter table public.transactions add constraint transactions_receipt_no_on_receipts
  check (receipt_no is null or (direction = 'in' and reverses_id is null));

-- App users may set the donor name; the receipt number stays system-only.
revoke insert on public.transactions from authenticated;
grant insert (
  id, masjid_id, fund_id, category_id, amount_sen, direction, date, ref_no, method, status,
  reverses_id, household_id, created_by, note, reversal_reason, attachment_path, received_from
) on public.transactions to authenticated;

-- The donor name is personal data: the audit log notes that it was there,
-- not what it said.
drop trigger audit_row on public.transactions;
create trigger audit_row after insert or update or delete on public.transactions
  for each row execute function private.audit_row('received_from');

-- Numbering ------------------------------------------------------------------

-- Runs after the other checks (triggers run in name order). If anything later
-- refuses the entry, the whole transaction rolls back, counter included, so
-- no number is ever skipped. Numbers already given (Friday collections) stay.
create function private.assign_receipt_no()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.direction = 'in' and new.reverses_id is null and new.receipt_no is null then
    new.receipt_no := private.next_receipt_no(new.masjid_id, extract(year from new.date)::integer);
  end if;
  return new;
end;
$$;

revoke all on function private.assign_receipt_no() from public, anon, authenticated;

create trigger zz_assign_receipt_no before insert on public.transactions
  for each row execute function private.assign_receipt_no();

-- Imarah credit on receipts ---------------------------------------------------

-- Only honoured on paid plans; the Asas plan always shows the credit.
alter table public.masjids add column receipt_hide_credit boolean not null default false;
grant update (receipt_hide_credit) on public.masjids to authenticated;

-- Emailed receipts --------------------------------------------------------------

-- The audit log notes that a receipt was emailed, never to whom.
alter table public.audit_log drop constraint audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check
  check (action in ('INSERT', 'UPDATE', 'DELETE', 'VIEW', 'EMAIL'));

create function public.log_receipt_emailed(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  masjid uuid := private.current_masjid_id();
begin
  if auth.uid() is null or masjid is null or not private.has_role('pengerusi', 'bendahari') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.transactions t
    where t.id = p_id and t.masjid_id = masjid and t.receipt_no is not null
  ) then
    raise exception 'receipt: not found';
  end if;

  insert into public.audit_log (masjid_id, user_id, table_name, row_id, action)
  values (masjid, auth.uid(), 'transactions', p_id, 'EMAIL');
end;
$$;

revoke all on function public.log_receipt_emailed(uuid) from public, anon;
grant execute on function public.log_receipt_emailed(uuid) to authenticated;
