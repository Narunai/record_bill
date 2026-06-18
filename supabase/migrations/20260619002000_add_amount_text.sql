alter table public.transactions
add column if not exists amount_text text;
