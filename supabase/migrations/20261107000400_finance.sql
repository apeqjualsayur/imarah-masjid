-- Funds, the cash book, collections, bank lines, month locks, receipts, reports.
-- All money is integer sen.

create table public.funds (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null default private.current_masjid_id()
    references public.masjids (id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  restricted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (masjid_id, id),
  unique (masjid_id, name)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null default private.current_masjid_id()
    references public.masjids (id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  type text not null check (type in ('income', 'expense')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (masjid_id, id),
  unique (masjid_id, name, type)
);

-- Append-only. `status` has one value in Phase 1 because a transaction is
-- never edited; corrections are reversing entries.
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null default private.current_masjid_id()
    references public.masjids (id) on delete restrict,
  fund_id uuid not null,
  category_id uuid,
  amount_sen bigint not null check (amount_sen > 0),
  direction text not null check (direction in ('in', 'out')),
  date date not null,
  ref_no text,
  method text not null
    check (method in ('cash', 'bank_transfer', 'duitnow', 'cheque')),
  status text not null default 'posted' check (status = 'posted'),
  reverses_id uuid unique,
  household_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (masjid_id, id),
  check (reverses_id is distinct from id),
  foreign key (masjid_id, fund_id)
    references public.funds (masjid_id, id) on delete restrict,
  foreign key (masjid_id, category_id)
    references public.categories (masjid_id, id) on delete restrict,
  foreign key (masjid_id, reverses_id)
    references public.transactions (masjid_id, id) on delete restrict,
  foreign key (masjid_id, household_id)
    references public.households (masjid_id, id) on delete restrict
);

create index transactions_masjid_date_idx on public.transactions (masjid_id, date);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null default private.current_masjid_id()
    references public.masjids (id) on delete restrict,
  date date not null,
  fund_id uuid not null,
  total_sen bigint not null check (total_sen > 0),
  counted_by uuid not null references auth.users (id) on delete restrict,
  confirmed_by uuid references auth.users (id) on delete restrict,
  transaction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (confirmed_by is distinct from counted_by),
  foreign key (masjid_id, fund_id)
    references public.funds (masjid_id, id) on delete restrict,
  foreign key (masjid_id, transaction_id)
    references public.transactions (masjid_id, id) on delete restrict
);

create index collections_masjid_date_idx on public.collections (masjid_id, date);

create table public.bank_lines (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null default private.current_masjid_id()
    references public.masjids (id) on delete restrict,
  date date not null,
  amount_sen bigint not null check (amount_sen <> 0),
  description text,
  matched_transaction_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (masjid_id, matched_transaction_id)
    references public.transactions (masjid_id, id) on delete restrict
);

create index bank_lines_masjid_date_idx on public.bank_lines (masjid_id, date);

create table public.periods (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null default private.current_masjid_id()
    references public.masjids (id) on delete restrict,
  month date not null check (extract(day from month) = 1),
  locked_at timestamptz,
  locked_by uuid references auth.users (id) on delete restrict,
  unlock_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (masjid_id, month)
);

create table public.receipt_counters (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null default private.current_masjid_id()
    references public.masjids (id) on delete restrict,
  year integer not null check (year between 2000 and 2100),
  last_no integer not null default 0 check (last_no >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (masjid_id, year)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  masjid_id uuid not null default private.current_masjid_id()
    references public.masjids (id) on delete restrict,
  type text not null check (length(trim(type)) > 0),
  period text not null check (period ~ '^[0-9]{4}(-[0-9]{2})?$'),
  storage_path text not null,
  generated_by uuid default auth.uid() references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reports_masjid_period_idx on public.reports (masjid_id, period);

create trigger set_updated_at before update on public.funds
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.categories
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.collections
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.bank_lines
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.periods
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.receipt_counters
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.reports
  for each row execute function private.set_updated_at();
