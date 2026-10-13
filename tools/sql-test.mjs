// Testy migracji SQL na PostgreSQL w Node (PGlite) z atrapą schematu auth i ról Supabase.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const db = new PGlite();
let fails = 0;
const ok = (name, cond, extra) => { console.log((cond ? 'OK   ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); if (!cond) fails++; };

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key, email text,
    is_anonymous boolean not null default false,
    raw_user_meta_data jsonb not null default '{}'::jsonb);
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`);
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
  await db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  ok('migracja ' + f, true);
}

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const N = '33333333-3333-3333-3333-333333333333'; // konto anonimowe

// Zapytanie jako gracz (uid) albo jako niezalogowany (uid = null → rola anon).
async function as(uid, sql, params = [], { anonymous = false } = {}) {
  const role = uid ? 'authenticated' : 'anon';
  const claims = uid ? JSON.stringify({ sub: uid, role, is_anonymous: anonymous }) : '';
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
  await db.exec(`set role ${role}`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
async function rejects(name, fn) {
  try { await fn(); ok(name + ' (oczekiwano błędu)', false); }
  catch (e) { ok(name + ' -> ' + e.message.split('\n')[0], true); }
}
const signUp = (id, meta, extra = {}) =>
  db.query(`insert into auth.users (id, email, is_anonymous, raw_user_meta_data) values ($1, $2, $3, $4)`,
    [id, extra.email ?? id.slice(0, 4) + '@test.pl', extra.anonymous ?? false, JSON.stringify(meta)]);
const iso = minutes => new Date(Date.now() + minutes * 60000).toISOString();
const item = (extra = {}) => ({ difficulty: 'easy', seed: 42, path: 'RD', moves: 2, elapsed_ms: 5000, hints_used: 1,
  status: 'won', started_at: iso(-10), finished_at: iso(-9), ...extra });
const importAs = (uid, items, opts) => as(uid, `select public.import_guest_games($1::jsonb) as n`, [JSON.stringify(items)], opts);

// ---- Rejestracja i profil ----
await signUp(A, { username: 'Justyna' });
let r = await db.query(`select username, muted from public.profiles where id = $1`, [A]);
ok('profil tworzy się przy rejestracji', r.rows.length === 1 && r.rows[0].username === 'Justyna' && r.rows[0].muted === false);

await rejects('zajęta nazwa (inna wielkość liter) przerywa rejestrację', () => signUp(B, { username: 'justyna' }));
r = await db.query(`select 1 from auth.users where id = $1`, [B]);
ok('po nieudanej rejestracji nie zostaje konto bez profilu', r.rows.length === 0);
await rejects('za krótka nazwa', () => signUp(B, { username: 'ab' }));
await rejects('niedozwolone znaki w nazwie', () => signUp(B, { username: 'zła nazwa' }));
await rejects('brak nazwy', () => signUp(B, {}));
await signUp(B, { username: 'Bartek_2' });
await signUp(N, {}, { anonymous: true });
r = await db.query(`select 1 from public.profiles where id = $1`, [N]);
ok('konto anonimowe nie dostaje profilu', r.rows.length === 0);

// ---- username_available ----
const avail = async (uid, name) => (await as(uid, `select public.username_available($1) as v`, [name])).rows[0].v;
ok('username_available: zajęta (bez logowania)', (await avail(null, 'JUSTYNA')) === false);
ok('username_available: wolna', (await avail(null, 'nowy_gracz')) === true);
ok('username_available: zła nazwa = niedostępna', (await avail(null, 'a b')) === false);
ok('username_available: działa też po zalogowaniu', (await avail(A, 'bartek_2')) === false);

// ---- RLS profili ----
r = await as(A, `select id, username from public.profiles`);
ok('gracz widzi tylko swój profil', r.rows.length === 1 && r.rows[0].id === A);
r = await as(A, `update public.profiles set muted = true where id = $1 returning muted`, [A]);
ok('gracz zmienia swoje wyciszenie', r.rows[0]?.muted === true);
r = await as(A, `update public.profiles set muted = true where id = $1 returning id`, [B]);
ok('gracz nie zmienia cudzego profilu', r.rows.length === 0);
await rejects('gracz nie zmienia nazwy', () => as(A, `update public.profiles set username = 'Inna' where id = $1`, [A]));
await rejects('gracz nie tworzy profili', () => as(A, `insert into public.profiles (id, username) values ($1, 'x_y_z')`, [N]));
await rejects('gracz nie usuwa profilu', () => as(A, `delete from public.profiles where id = $1`, [A]));
await rejects('bez logowania brak dostępu do profili', () => as(null, `select * from public.profiles`));

// ---- games: tylko prawdziwe konta ----
await rejects('konto anonimowe nie zaczyna gry', () =>
  as(N, `insert into public.games (difficulty, seed) values ('easy', 1)`, [], { anonymous: true }));
r = await as(A, `insert into public.games (difficulty, seed) values ('medium', 7) returning id, status`);
const playingId = r.rows[0].id;
ok('konto zaczyna grę', r.rows[0].status === 'playing');
await rejects('nadal: ruchy niezgodne ze ścieżką', () => as(A, `update public.games set path = 'RR', moves = 1 where id = $1`, [playingId]));

// ---- import_guest_games ----
r = await importAs(A, [item(), item({ seed: 43, status: 'gaveup', path: 'R', moves: 1 })]);
ok('import zapisuje 2 gry', r.rows[0].n === 2, 'n=' + r.rows[0].n);
r = await as(A, `select status from public.games where id = $1`, [playingId]);
ok('import nie porzuca gry w toku', r.rows[0].status === 'playing');
r = await as(A, `select status, started_at, finished_at from public.games where seed = 42`);
ok('import zachowuje status i daty gościa', r.rows[0].status === 'won' && Math.abs(new Date(r.rows[0].finished_at) - Date.now() - (-9 * 60000)) < 5000);
r = await importAs(A, [item()]);
ok('duplikat jest pomijany', r.rows[0].n === 0);
await rejects('import: status playing', () => importAs(A, [item({ seed: 50, status: 'playing' })]));
await rejects('import: data z przyszłości', () => importAs(A, [item({ seed: 51, finished_at: iso(60) })]));
await rejects('import: wynik starszy niż 30 dni', () => importAs(A, [item({ seed: 52, started_at: iso(-60 * 24 * 31 - 1), finished_at: iso(-60 * 24 * 31) })]));
await rejects('import: początek po końcu', () => importAs(A, [item({ seed: 53, started_at: iso(-1), finished_at: iso(-2) })]));
await rejects('import: ruchy niezgodne ze ścieżką', () => importAs(A, [item({ seed: 54, moves: 5 })]));
await rejects('import: ponad 20 wyników', () => importAs(A, Array.from({ length: 21 }, (_, i) => item({ seed: 100 + i }))));
await rejects('import: bez logowania', () => importAs(null, [item({ seed: 55 })]));
await rejects('import: konto anonimowe', () => importAs(N, [item({ seed: 56 })], { anonymous: true }));
r = await importAs(A, [item({ seed: 57, finished_at: iso(2), started_at: iso(-1) })]);
ok('import: lekko przyspieszony zegar (+2 min) jest przycinany', r.rows[0].n === 1);
r = await as(A, `select finished_at from public.games where seed = 57`);
ok('przycięta data końca nie jest z przyszłości', new Date(r.rows[0].finished_at) <= new Date(Date.now() + 1000));
r = await as(B, `select count(*)::int as c from public.games`);
ok('B nie widzi gier A', r.rows[0].c === 0);
r = await as(A, `insert into public.games (difficulty, seed) values ('easy', 8) returning id`);
r = await as(A, `select status from public.games where id = $1`, [playingId]);
ok('po imporcie zwykła nowa gra nadal porzuca poprzednią', r.rows[0].status === 'abandoned');

// ---- my_stats ----
r = await as(A, `select * from public.my_stats`);
const s = r.rows[0];
ok('my_stats: rozegrane, wygrane, poddane, porzucone', Number(s.played) === 4 && Number(s.won) === 2 && Number(s.gaveup) === 1 && Number(s.abandoned) === 1,
  JSON.stringify(s));
ok('my_stats: łączny czas', Number(s.total_ms) === 15000, String(s.total_ms));
r = await as(B, `select * from public.my_stats`);
ok('my_stats: nowy gracz ma zera', r.rows.length === 1 && Number(r.rows[0].played) === 0);
await rejects('my_stats bez logowania', () => as(null, `select * from public.my_stats`));

// ---- Usunięcie konta ----
await db.query(`delete from auth.users where id = $1`, [A]);
r = await db.query(`select (select count(*) from public.profiles where id = $1)::int as p, (select count(*) from public.games where player_id = $1)::int as g`, [A]);
ok('usunięcie konta usuwa profil i gry', r.rows[0].p === 0 && r.rows[0].g === 0);

console.log(fails ? `\n${fails} niepowodzeń` : '\nWszystko OK');
process.exit(fails ? 1 : 0);
