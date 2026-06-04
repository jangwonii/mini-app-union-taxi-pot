create extension if not exists pgcrypto;

create table if not exists public.taxi_pots (
  id uuid primary key default gen_random_uuid(),
  start_location text not null check (char_length(start_location) between 2 and 120),
  destination text not null check (char_length(destination) between 2 and 120),
  departure_time timestamptz not null,
  estimated_fare integer not null check (estimated_fare between 1000 and 300000),
  max_riders integer not null check (max_riders between 2 and 6),
  description text not null check (char_length(description) between 10 and 1200),
  tags text[] not null default '{}',
  open_chat_url text not null check (open_chat_url ~ '^https?://'),
  owner_user_id text not null,
  owner_nickname text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.join_requests (
  id uuid primary key default gen_random_uuid(),
  pot_id uuid not null references public.taxi_pots(id) on delete cascade,
  requester_user_id text not null,
  requester_nickname text not null,
  message text not null check (char_length(message) between 2 and 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pot_id, requester_user_id)
);

create index if not exists taxi_pots_status_departure_time_idx on public.taxi_pots (status, departure_time asc);
create index if not exists taxi_pots_tags_idx on public.taxi_pots using gin (tags);
create index if not exists join_requests_pot_id_status_idx on public.join_requests (pot_id, status);
create index if not exists join_requests_requester_user_id_idx on public.join_requests (requester_user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists taxi_pots_set_updated_at on public.taxi_pots;
create trigger taxi_pots_set_updated_at
before update on public.taxi_pots
for each row execute function public.set_updated_at();

drop trigger if exists join_requests_set_updated_at on public.join_requests;
create trigger join_requests_set_updated_at
before update on public.join_requests
for each row execute function public.set_updated_at();
