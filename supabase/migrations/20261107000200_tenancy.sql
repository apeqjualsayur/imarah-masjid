-- Tenancy: masjids, memberships, and the helpers every access rule relies on.

create table public.masjids (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  address text,
  state text,
  logo_path text,
  plan text not null default 'asas'
    check (plan in ('asas', 'standard', 'pro', 'daerah_negeri')),
  prayer_zone text,
  duitnow_payload text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete restrict,
  masjid_id uuid not null references public.masjids (id) on delete restrict,
  role text not null
    check (role in ('pengerusi', 'bendahari', 'setiausaha', 'ajk', 'imam')),
  status text not null default 'active'
    check (status in ('active', 'invited', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index memberships_masjid_id_idx on public.memberships (masjid_id);

create trigger set_updated_at before update on public.masjids
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.memberships
  for each row execute function private.set_updated_at();

-- The caller's masjid and role. Only an active membership counts, so removing
-- someone cuts their access immediately.
create function private.user_context(out masjid_id uuid, out role text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.masjid_id, m.role
  from public.memberships m
  where m.user_id = auth.uid() and m.status = 'active';
$$;

create function private.current_masjid_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select (private.user_context()).masjid_id;
$$;

create function private.has_role(variadic roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((private.user_context()).role = any (roles), false);
$$;
