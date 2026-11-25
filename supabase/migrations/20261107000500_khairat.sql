-- Khairat: the yearly fee, and each household's payment against it.

create table public.khairat_plans (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null default private.current_masjid_id()
    references public.masjids (id) on delete restrict,
  year integer not null check (year between 2000 and 2100),
  fee_sen bigint not null check (fee_sen >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (masjid_id, id),
  unique (masjid_id, year)
);

create table public.khairat_members (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null default private.current_masjid_id()
    references public.masjids (id) on delete restrict,
  household_id uuid not null,
  plan_id uuid not null,
  paid_sen bigint not null default 0 check (paid_sen >= 0),
  status text not null default 'active' check (status in ('active', 'lapsed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (masjid_id, household_id, plan_id),
  foreign key (masjid_id, household_id)
    references public.households (masjid_id, id) on delete restrict,
  foreign key (masjid_id, plan_id)
    references public.khairat_plans (masjid_id, id) on delete restrict
);

create trigger set_updated_at before update on public.khairat_plans
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.khairat_members
  for each row execute function private.set_updated_at();
