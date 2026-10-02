-- Run in Supabase → SQL Editor after 0001_init.sql, with your real emails.
-- Use the same emails you will sign in with.
insert into public.members (email, person) values
  ('PIEPIE_EMAIL_HERE', 'P'),
  ('MUNNY_EMAIL_HERE',  'M')
on conflict (email) do update set person = excluded.person;
