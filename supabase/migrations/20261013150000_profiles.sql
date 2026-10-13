-- Nić Ariadny: konta graczy. Profil z nazwą użytkownika, zapis wyników gościa po zalogowaniu,
-- statystyki. Do gier mają dostęp tylko prawdziwe konta (bez anonimowych).

-- ---- Profil ----

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  muted      boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Profil gracza: nazwa użytkownika (do logowania i wyświetlania) i ustawienia.';

-- Nazwa unikalna bez względu na wielkość liter.
create unique index profiles_username_lower on public.profiles (lower(username));

alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (muted) on public.profiles to authenticated;

create policy "Gracz widzi swój profil"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Gracz zmienia swój profil"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Profil powstaje razem z kontem. Zła lub zajęta nazwa przerywa rejestrację,
-- więc nie zostaje konto bez profilu.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_anonymous then
    return new;
  end if;
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Czy nazwa jest wolna – do podpowiedzi w formularzu rejestracji. Zwraca tylko tak/nie.
create function public.username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select name ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where lower(username) = lower(name));
$$;

revoke execute on function public.username_available(text) from public, anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;

-- ---- Gry: tylko prawdziwe konta ----

drop policy "Gracz widzi swoje gry" on public.games;
drop policy "Gracz zaczyna swoje gry" on public.games;
drop policy "Gracz zapisuje swoje gry" on public.games;

create policy "Gracz widzi swoje gry"
  on public.games for select to authenticated
  using ((select auth.uid()) = player_id
         and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false));

create policy "Gracz zaczyna swoje gry"
  on public.games for insert to authenticated
  with check ((select auth.uid()) = player_id
              and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false));

create policy "Gracz zapisuje swoje gry"
  on public.games for update to authenticated
  using ((select auth.uid()) = player_id
         and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false))
  with check ((select auth.uid()) = player_id
              and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false));

-- Wyzwalacz nowej gry: wyjątek dla importu wyników gościa (flaga ustawiana tylko
-- w import_guest_games) – wtedy gra wchodzi jako zakończona i nie porzuca gry w toku.
create or replace function public.games_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('app.importing_guest_games', true) = 'on' then
    return new;
  end if;
  new.status      := 'playing';
  new.finished_at := null;
  new.started_at  := now();
  new.updated_at  := now();
  update public.games
     set status = 'abandoned'
   where player_id = new.player_id
     and status = 'playing';
  return new;
end;
$$;

-- ---- Import wyników gościa ----

create function public.import_guest_games(items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid      uuid := auth.uid();
  item     jsonb;
  started  timestamptz;
  finished timestamptz;
  added    integer := 0;
  n        integer;
begin
  if uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Zapis wyników wymaga zalogowania' using errcode = '42501';
  end if;
  if jsonb_typeof(items) is distinct from 'array' then
    raise exception 'Oczekiwano listy wyników' using errcode = '22023';
  end if;
  if jsonb_array_length(items) > 20 then
    raise exception 'Najwyżej 20 wyników naraz' using errcode = '22023';
  end if;

  perform set_config('app.importing_guest_games', 'on', true);
  for item in select value from jsonb_array_elements(items) loop
    if coalesce(item ->> 'status', '') not in ('won', 'gaveup') then
      raise exception 'Można zapisać tylko zakończone gry' using errcode = '22023';
    end if;
    started  := (item ->> 'started_at')::timestamptz;
    finished := (item ->> 'finished_at')::timestamptz;
    if started is null or finished is null or started > finished
       or finished > now() + interval '5 minutes'
       or finished < now() - interval '30 days' then
      raise exception 'Nieprawidłowe daty gry' using errcode = '22023';
    end if;
    -- Zegar przeglądarki może się lekko spieszyć – daty nie mogą być z przyszłości.
    finished := least(finished, now());
    started  := least(started, finished);

    insert into public.games
      (player_id, difficulty, seed, path, moves, elapsed_ms, hints_used, status, started_at, updated_at, finished_at)
    select uid, item ->> 'difficulty', (item ->> 'seed')::bigint, item ->> 'path', (item ->> 'moves')::integer,
           (item ->> 'elapsed_ms')::integer, (item ->> 'hints_used')::smallint, item ->> 'status',
           started, finished, finished
     where not exists (
       select 1 from public.games g
        where g.player_id = uid
          and g.seed = (item ->> 'seed')::bigint
          and g.path = item ->> 'path'
          and g.status = item ->> 'status');
    get diagnostics n = row_count;
    added := added + n;
  end loop;
  perform set_config('app.importing_guest_games', 'off', true);
  return added;
end;
$$;

revoke execute on function public.import_guest_games(jsonb) from public, anon, authenticated;
grant execute on function public.import_guest_games(jsonb) to authenticated;

-- ---- Statystyki gracza (zawsze jeden wiersz) ----

create view public.my_stats
with (security_invoker = true) as
select count(*) filter (where status <> 'playing')   as played,
       count(*) filter (where status = 'won')         as won,
       count(*) filter (where status = 'gaveup')      as gaveup,
       count(*) filter (where status = 'abandoned')   as abandoned,
       coalesce(sum(elapsed_ms), 0)                   as total_ms
  from public.games;

revoke all on public.my_stats from anon, authenticated;
grant select on public.my_stats to authenticated;
