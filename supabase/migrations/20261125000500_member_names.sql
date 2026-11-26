-- Names of the people in the caller's own masjid, so screens can say who
-- recorded or cancelled an entry. Names only: no emails, no other details.
-- Names live in auth.users, which app users cannot read directly.
create function public.member_names()
returns table (user_id uuid, full_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), '—')
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.masjid_id = private.current_masjid_id()
    and private.current_masjid_id() is not null;
$$;

revoke all on function public.member_names() from public, anon;
grant execute on function public.member_names() to authenticated;
