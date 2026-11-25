-- Kariah registry. Links between tables carry masjid_id, so a row can never
-- point at another masjid's record.

create table public.households (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null default private.current_masjid_id()
    references public.masjids (id) on delete restrict,
  head_name text not null check (length(trim(head_name)) > 0),
  address text,
  phone text,
  whatsapp_opt_in boolean not null default false,
  pdpa_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (masjid_id, id)
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null default private.current_masjid_id()
    references public.masjids (id) on delete restrict,
  household_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  ic_last4 text check (ic_last4 ~ '^[0-9]{4}$'),
  date_of_birth date,
  relation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (masjid_id, household_id)
    references public.households (masjid_id, id) on delete cascade
);

create index members_household_idx on public.members (masjid_id, household_id);

create trigger set_updated_at before update on public.households
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.members
  for each row execute function private.set_updated_at();
