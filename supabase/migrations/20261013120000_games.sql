-- Nić Ariadny: zapis wyników rozgrywki i wznawianie przerwanej gry.
-- Jedna tabela `games`: jeden wiersz = jedna rozgrywka. Gra w toku ma status 'playing'.
-- Gracz to anonimowy użytkownik Supabase Auth (signInAnonymously), więc auth.uid()
-- jednoznacznie wskazuje właściciela, a RLS pilnuje, by każdy widział tylko swoje gry.

create table public.games (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  difficulty  text not null check (difficulty in ('easy', 'medium', 'hard')),
  -- Ziarno dla Maze.mulberry32 (uint32): z niego generator odtwarza ten sam labirynt.
  seed        bigint not null check (seed between 0 and 4294967295),
  -- Udane ruchy po kolei: U(p), D(own), L(eft), R(ight). Z nich odtwarzamy pozycję i nić.
  path        text not null default '' check (path ~ '^[UDLR]*$'),
  moves       integer not null default 0,
  elapsed_ms  integer not null default 0 check (elapsed_ms >= 0),
  hints_used  smallint not null default 0 check (hints_used between 0 and 3),
  status      text not null default 'playing'
              check (status in ('playing', 'won', 'gaveup', 'abandoned')),
  started_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  finished_at timestamptz,
  constraint games_moves_match_path check (moves = char_length(path)),
  constraint games_finished_when_not_playing check ((status = 'playing') = (finished_at is null))
);

comment on table public.games is 'Rozgrywki gry Nić Ariadny: historia wyników i stan gry w toku do wznowienia.';

-- Najwyżej jedna gra w toku na gracza – to ona jest wznawiana.
create unique index games_one_playing_per_player on public.games (player_id) where status = 'playing';
-- Historia gier gracza, od najnowszych.
create index games_player_started on public.games (player_id, started_at desc);

-- Nowa gra: zawsze startuje jako 'playing', a poprzednia gra w toku zostaje porzucona.
create function public.games_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
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

create trigger games_before_insert
  before insert on public.games
  for each row execute function public.games_before_insert();

-- Zmiany w grze: zakończonej gry nie da się już ruszyć, a w trakcie gry
-- ruchy, czas i podpowiedzi mogą tylko przybywać.
create function public.games_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'playing' then
    raise exception 'Zakończonej gry nie można zmieniać (status: %)', old.status;
  end if;
  if new.player_id  <> old.player_id
     or new.difficulty <> old.difficulty
     or new.seed       <> old.seed
     or new.started_at <> old.started_at then
    raise exception 'Nie można zmienić gracza, poziomu, ziarna ani daty rozpoczęcia gry';
  end if;
  if left(new.path, char_length(old.path)) <> old.path then
    raise exception 'Ruchy można tylko dopisywać na końcu ścieżki';
  end if;
  if new.elapsed_ms < old.elapsed_ms or new.hints_used < old.hints_used then
    raise exception 'Czas gry i liczba podpowiedzi nie mogą maleć';
  end if;
  new.updated_at  := now();
  new.finished_at := case when new.status = 'playing' then null else now() end;
  return new;
end;
$$;

create trigger games_before_update
  before update on public.games
  for each row execute function public.games_before_update();

-- Dostęp: tylko zalogowani (także anonimowo) i tylko do własnych gier. Bez usuwania.
alter table public.games enable row level security;

revoke all on public.games from anon, authenticated;
grant select, insert, update on public.games to authenticated;

create policy "Gracz widzi swoje gry"
  on public.games for select to authenticated
  using ((select auth.uid()) = player_id);

create policy "Gracz zaczyna swoje gry"
  on public.games for insert to authenticated
  with check ((select auth.uid()) = player_id);

create policy "Gracz zapisuje swoje gry"
  on public.games for update to authenticated
  using ((select auth.uid()) = player_id)
  with check ((select auth.uid()) = player_id);

-- Rekordy gracza liczone z wygranych gier. security_invoker = RLS tabeli działa też tu.
create view public.my_best
with (security_invoker = true) as
select difficulty,
       min(elapsed_ms) as best_ms,
       min(moves)      as best_moves,
       count(*)        as wins
  from public.games
 where status = 'won'
 group by difficulty;

revoke all on public.my_best from anon, authenticated;
grant select on public.my_best to authenticated;
