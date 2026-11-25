-- Step 3: onboarding, invitations, the user list and the platform admin.
-- Functions here are security definer because each one does something no
-- ordinary row policy can express (for example joining a masjid you do not
-- belong to yet). Each one checks the caller itself.

-- Platform admin ------------------------------------------------------------

-- The flag lives in app_metadata, which only the service role can set.
create function private.flagged_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'platform_admin')::boolean, false);
$$;

-- A usable admin session: flagged, passed 2-step verification this session,
-- and not a member of any masjid.
create function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.flagged_platform_admin()
    and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and not exists (select 1 from public.memberships m where m.user_id = auth.uid());
$$;

-- Admin views are written to the masjid's own audit log.
alter table public.audit_log drop constraint audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check
  check (action in ('INSERT', 'UPDATE', 'DELETE', 'VIEW'));

-- Invitations ---------------------------------------------------------------

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null default private.current_masjid_id()
    references public.masjids (id) on delete restrict,
  email text not null check (email = lower(trim(email)) and email like '_%@_%'),
  role text not null
    check (role in ('pengerusi', 'bendahari', 'setiausaha', 'ajk', 'imam')),
  -- Only a hash is stored. The link itself is shown once to the Pengerusi.
  token_hash text not null unique,
  invited_by uuid not null default auth.uid() references auth.users (id) on delete restrict,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete restrict,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invitations_masjid_id_idx on public.invitations (masjid_id);
-- One open invitation per email per masjid. The app revokes the old one first.
create unique index invitations_one_open_idx on public.invitations (masjid_id, email)
  where accepted_at is null and revoked_at is null;

create trigger set_updated_at before update on public.invitations
  for each row execute function private.set_updated_at();
create trigger audit_row after insert or update or delete on public.invitations
  for each row execute function private.audit_row('email', 'token_hash');

alter table public.invitations enable row level security;

grant select, insert on public.invitations to authenticated;
grant update (revoked_at) on public.invitations to authenticated;

create policy invitations_select on public.invitations for select to authenticated
  using (masjid_id = (select private.current_masjid_id()) and (select private.has_role('pengerusi')));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (masjid_id = (select private.current_masjid_id())
    and (select private.has_role('pengerusi'))
    and invited_by = (select auth.uid())
    and accepted_at is null
    and accepted_by is null
    and revoked_at is null);
-- Revoking is the only change, and only while the invitation is still open.
create policy invitations_revoke on public.invitations for update to authenticated
  using (masjid_id = (select private.current_masjid_id())
    and (select private.has_role('pengerusi'))
    and accepted_at is null
    and revoked_at is null)
  with check (masjid_id = (select private.current_masjid_id()));

-- Onboarding ----------------------------------------------------------------

-- A signed-in user with no membership creates a masjid and becomes its
-- Pengerusi, in one step.
create function public.create_masjid(p_name text, p_state text, p_address text, p_prayer_zone text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
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
  returning id into new_id;

  insert into public.memberships (user_id, masjid_id, role, status)
  values (uid, new_id, 'pengerusi', 'active');

  return new_id;
end;
$$;

-- What the invitation page shows before anyone signs in. The token itself is
-- the secret, so whoever holds the link may see who it is for.
create function public.invitation_preview(p_token text)
returns table (masjid_name text, role text, email text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.name,
    i.role,
    i.email,
    case
      when i.accepted_at is not null then 'used'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at < now() then 'expired'
      else 'pending'
    end
  from public.invitations i
  join public.masjids m on m.id = i.masjid_id
  where i.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

-- The signed-in user joins the masjid on the invitation. The invitation must be
-- open and addressed to this user's email.
create function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  inv public.invitations;
  user_email text;
  existing public.memberships;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if private.flagged_platform_admin() then
    raise exception 'platform_admin' using errcode = '42501';
  end if;

  select * into inv
  from public.invitations i
  where i.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  for update;

  if not found then
    raise exception 'invitation_not_found';
  elsif inv.accepted_at is not null then
    raise exception 'invitation_used';
  elsif inv.revoked_at is not null then
    raise exception 'invitation_revoked';
  elsif inv.expires_at < now() then
    raise exception 'invitation_expired';
  end if;

  select lower(u.email) into user_email from auth.users u where u.id = uid;
  if user_email is distinct from inv.email then
    raise exception 'invitation_wrong_email' using errcode = '42501';
  end if;

  select * into existing from public.memberships m where m.user_id = uid for update;
  if found then
    -- Someone removed earlier can be invited back to the same masjid only.
    if existing.masjid_id = inv.masjid_id and existing.status = 'removed' then
      update public.memberships set role = inv.role, status = 'active' where id = existing.id;
    else
      raise exception 'already_member' using errcode = '42501';
    end if;
  else
    insert into public.memberships (user_id, masjid_id, role, status)
    values (uid, inv.masjid_id, inv.role, 'active');
  end if;

  update public.invitations set accepted_at = now(), accepted_by = uid where id = inv.id;

  return inv.masjid_id;
end;
$$;

-- Users page --------------------------------------------------------------

-- Names and emails live in auth.users, which app users cannot read. This gives
-- the Pengerusi the list for their own masjid only.
create function public.masjid_users()
returns table (user_id uuid, full_name text, email text, role text, status text, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, u.raw_user_meta_data ->> 'full_name', u.email::text, m.role, m.status, m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.masjid_id = private.current_masjid_id()
    and private.has_role('pengerusi')
  order by m.status, m.created_at;
$$;

-- Platform admin functions ------------------------------------------------

create function public.admin_list_masjids()
returns table (id uuid, name text, state text, plan text, user_count integer, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not private.is_platform_admin() then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;

  insert into public.audit_log (masjid_id, user_id, table_name, row_id, action)
  select m.id, auth.uid(), 'masjids', m.id, 'VIEW' from public.masjids m;

  return query
  select
    m.id,
    m.name,
    m.state,
    m.plan,
    (select count(*)::integer from public.memberships ms where ms.masjid_id = m.id and ms.status = 'active'),
    m.created_at
  from public.masjids m
  order by m.created_at desc;
end;
$$;

-- The plan change itself is written to the audit log by the masjids trigger.
create function public.admin_set_plan(p_masjid_id uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;

  update public.masjids set plan = p_plan where id = p_masjid_id;
  if not found then
    raise exception 'masjid_not_found';
  end if;
end;
$$;

-- Access to the functions ------------------------------------------------

revoke all on function private.flagged_platform_admin() from public, anon, authenticated;
revoke all on function private.is_platform_admin() from public, anon, authenticated;

revoke all on function public.create_masjid(text, text, text, text) from public, anon;
revoke all on function public.invitation_preview(text) from public;
revoke all on function public.accept_invitation(text) from public, anon;
revoke all on function public.masjid_users() from public, anon;
revoke all on function public.admin_list_masjids() from public, anon;
revoke all on function public.admin_set_plan(uuid, text) from public, anon;

grant execute on function public.create_masjid(text, text, text, text) to authenticated;
grant execute on function public.invitation_preview(text) to anon, authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.masjid_users() to authenticated;
grant execute on function public.admin_list_masjids() to authenticated;
grant execute on function public.admin_set_plan(uuid, text) to authenticated;

grant select, insert, update, delete on public.invitations to service_role;
