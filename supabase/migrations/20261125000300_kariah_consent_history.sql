-- Step 5: WhatsApp consent gets a date like PDPA consent, and a change history
-- per household for the Pengerusi and Bendahari.

alter table public.households add column whatsapp_consent_at timestamptz;

-- Households that already said yes get the best date we have.
update public.households
set whatsapp_consent_at = coalesce(pdpa_consent_at, created_at)
where whatsapp_opt_in and whatsapp_consent_at is null;

-- The yes/no and its date always agree.
alter table public.households add constraint households_whatsapp_consent_dated
  check (whatsapp_opt_in = (whatsapp_consent_at is not null));

-- Who changed what, and when, for one household and its members. Personal
-- fields were never stored in the log, so they arrive as "[changed]" or
-- "[hidden]". Only for roles that may view the audit log (Pengerusi, Bendahari).
create function public.household_history(p_household_id uuid)
returns table (at timestamptz, action text, table_name text, user_name text, before jsonb, after jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.at,
    l.action,
    l.table_name,
    coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), u.email::text),
    l.before,
    l.after
  from public.audit_log l
  left join auth.users u on u.id = l.user_id
  where l.masjid_id = private.current_masjid_id()
    and private.has_role('pengerusi', 'bendahari')
    and (
      (l.table_name = 'households' and l.row_id = p_household_id)
      or (l.table_name = 'members'
        and coalesce(l.after ->> 'household_id', l.before ->> 'household_id') = p_household_id::text)
    )
  order by l.at desc
  limit 100;
$$;

revoke all on function public.household_history(uuid) from public, anon;
grant execute on function public.household_history(uuid) to authenticated;
