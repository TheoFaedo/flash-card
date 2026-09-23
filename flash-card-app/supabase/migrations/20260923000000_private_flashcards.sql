create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 50 and name = btrim(name)),
  created_at timestamptz not null default now(),
  unique (user_id, id)
);

create unique index subjects_user_name_unique on public.subjects (user_id, lower(name));

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null check (length(question) between 1 and 500 and question = btrim(question)),
  answer text not null check (length(answer) between 1 and 1000 and answer = btrim(answer)),
  subject_id uuid,
  "column" integer not null default 1 check ("column" between 1 and 7),
  review_interval_started_on date not null,
  created_at timestamptz not null default now(),
  constraint cards_subject_owner foreign key (user_id, subject_id)
    references public.subjects (user_id, id) on delete set null (subject_id)
);

create index cards_user_created_idx on public.cards (user_id, created_at);
create index cards_user_subject_idx on public.cards (user_id, subject_id);

revoke all on public.subjects, public.cards from anon;
grant select, insert, update, delete on public.subjects, public.cards to authenticated;

alter table public.subjects enable row level security;
alter table public.cards enable row level security;

create policy "Users read own subjects" on public.subjects for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users create own subjects" on public.subjects for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users update own subjects" on public.subjects for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own subjects" on public.subjects for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users read own cards" on public.cards for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users create own cards" on public.cards for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users update own cards" on public.cards for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own cards" on public.cards for delete to authenticated
  using ((select auth.uid()) = user_id);

create schema if not exists private;

create or replace function private.create_default_subjects()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subjects (user_id, name)
  values (new.id, 'Général'), (new.id, 'Sciences'), (new.id, 'Histoire'),
    (new.id, 'Langues'), (new.id, 'Informatique');
  return new;
end;
$$;

revoke all on schema private from public, anon, authenticated;
revoke all on function private.create_default_subjects() from public, anon, authenticated;

create trigger on_auth_user_created_subjects
  after insert on auth.users
  for each row execute function private.create_default_subjects();
