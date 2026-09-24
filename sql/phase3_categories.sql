-- שלב ג': קטגוריה אוטומטית לכל שורת מחיר, לפי מילות מפתח בשם המוצר.
-- הרץ פעם אחת ב-Supabase SQL Editor (בנוסף לסקריפטים הקודמים).

alter table prices add column if not exists category text;

create index if not exists prices_category_idx on prices (category);
