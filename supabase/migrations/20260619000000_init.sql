create extension if not exists pgcrypto;

do $$
begin
  create type public.transaction_type as enum ('income', 'expense');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.transaction_type not null,
  amount double precision not null,
  category text not null,
  note text,
  date timestamptz not null default timezone('Asia/Bangkok', now())
);

create index if not exists idx_transactions_user_id on public.transactions(user_id);
create index if not exists idx_transactions_date on public.transactions(date);

alter table public.transactions enable row level security;

drop policy if exists "Transactions are viewable by owner" on public.transactions;
drop policy if exists "Transactions are insertable by owner" on public.transactions;
drop policy if exists "Transactions are updatable by owner" on public.transactions;
drop policy if exists "Transactions are deletable by owner" on public.transactions;

create policy "Transactions are viewable by owner"
on public.transactions
for select
to authenticated
using (auth.uid() = user_id);

create policy "Transactions are insertable by owner"
on public.transactions
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Transactions are updatable by owner"
on public.transactions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Transactions are deletable by owner"
on public.transactions
for delete
to authenticated
using (auth.uid() = user_id);
