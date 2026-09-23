-- שלב ב': טבלת מחירים + קישור ברקוד למוצרים בקטלוג האישי.
-- הרץ פעם אחת ב-Supabase SQL Editor (בנוסף לסקריפט הקודם schema.sql שכבר רץ).

create table if not exists prices (
  id          bigint generated always as identity primary key,
  chain       text not null,       -- שם הרשת בעברית, למשל 'רמי לוי'
  store_id    text not null,       -- מספר הסניף הרשמי ברשת (למשל '026')
  barcode     text not null,
  item_name   text not null,
  price       numeric not null,
  updated_at  timestamptz not null default now(),
  unique (chain, store_id, barcode)
);

alter table prices enable row level security;

-- קריאה בלבד למשתמשים מחוברים; הכתיבה נעשית רק דרך ה-GitHub Action
-- עם service_role key שעוקף RLS, אז אין צורך במדיניות insert/update כאן
create policy "authenticated read prices"
  on prices for select
  to authenticated
  using (true);

create extension if not exists pg_trgm;
create index if not exists prices_item_name_idx on prices using gin (item_name gin_trgm_ops);

alter table products add column if not exists barcode text;
