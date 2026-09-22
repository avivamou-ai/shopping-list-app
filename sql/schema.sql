-- הרץ את הסקריפט הזה פעם אחת ב-Supabase SQL Editor (Project → SQL Editor → New query)

create table if not exists products (
  id          bigint generated always as identity primary key,
  name        text not null,
  category    text not null default 'אחר',
  store       text not null default 'כל חנות',
  frequency   text not null default 'weekly' check (frequency in ('weekly', 'occasional')),
  active      boolean not null default true,
  on_list     boolean not null default true,
  checked     boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table products enable row level security;

-- כל משתמש מחובר (authenticated) רואה ועורך את כל הרשומות - זו רשימה משותפת למשפחה, לא נתונים פרטיים לכל משתמש
create policy "authenticated read products"
  on products for select
  to authenticated
  using (true);

create policy "authenticated insert products"
  on products for insert
  to authenticated
  with check (true);

create policy "authenticated update products"
  on products for update
  to authenticated
  using (true);

create policy "authenticated delete products"
  on products for delete
  to authenticated
  using (true);
