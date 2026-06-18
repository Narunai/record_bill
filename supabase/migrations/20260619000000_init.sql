create extension if not exists pgcrypto;

do $$
begin
  create type transaction_type as enum ('income', 'expense');
exception
  when duplicate_object then null;
end $$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  hashed_password text,
  full_name text,
  google_id text
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type transaction_type not null,
  amount double precision not null,
  category text not null,
  note text,
  date timestamptz not null default timezone('Asia/Bangkok', now())
);

create index if not exists idx_transactions_user_id on transactions(user_id);
create index if not exists idx_transactions_date on transactions(date);
create index if not exists idx_users_email on users(email);
