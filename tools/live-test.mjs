// Test na żywo: rejestracja, profil, logowanie e-mailem i nazwą (Edge Function), import wyników gościa.
// Tworzy konta e2e.*@mailinator.com – usuń je potem: supabase-admin.mjs query "delete from auth.users where email like 'e2e.%@mailinator.com'"
const URL_ = 'https://tiyvaauexqvlgpyewirt.supabase.co';
const KEY = 'sb_publishable_zYAZ5akuhrgRaigWM4FYGg_PvYMPI1b';
let fails = 0;
const ok = (name, cond, extra) => { console.log((cond ? 'OK   ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); if (!cond) fails++; };
const short = j => JSON.stringify(j).slice(0, 200);

async function call(method, p, { token, body } = {}) {
  const headers = { apikey: KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(URL_ + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

const rnd = Math.random().toString(36).slice(2, 8);
const user = { username: 'u_' + rnd, email: 'e2e.' + rnd + '@mailinator.com', password: 'Haslo-' + rnd + '!' };

let r = await call('POST', '/rest/v1/rpc/username_available', { body: { name: user.username } });
ok('nazwa wolna przed rejestracją', r.status === 200 && r.json === true, short(r.json));

r = await call('POST', '/auth/v1/signup', { body: {} });
ok('anonimowe logowanie wyłączone', r.status >= 400, 'HTTP ' + r.status);

r = await call('POST', '/auth/v1/signup', { body: { email: user.email, password: 'krotkie', data: { username: user.username } } });
ok('za krótkie hasło odrzucone', r.status >= 400, short(r.json));

r = await call('POST', '/auth/v1/signup', { body: { email: user.email, password: user.password, data: { username: user.username } } });
const token = r.json && r.json.access_token;
const uid = r.json && r.json.user && r.json.user.id;
ok('rejestracja bez potwierdzania maila daje sesję', r.status === 200 && !!token, 'HTTP ' + r.status + ' ' + short(r.json));
if (!token) process.exit(1);

r = await call('GET', '/rest/v1/profiles?select=username,muted', { token });
ok('profil utworzony', r.status === 200 && r.json[0]?.username === user.username, short(r.json));

r = await call('POST', '/rest/v1/rpc/username_available', { body: { name: user.username.toUpperCase() } });
ok('nazwa zajęta po rejestracji (inna wielkość liter)', r.json === false);

r = await call('POST', '/auth/v1/signup', { body: { email: 'e2e.x' + rnd + '@mailinator.com', password: user.password, data: { username: user.username.toUpperCase() } } });
ok('druga rejestracja z tą samą nazwą odrzucona', r.status >= 400, short(r.json));

r = await call('POST', '/auth/v1/token?grant_type=password', { body: { email: user.email, password: user.password } });
ok('logowanie e-mailem', r.status === 200 && !!r.json.access_token);

r = await call('POST', '/functions/v1/login', { body: { username: user.username.toUpperCase(), password: user.password } });
ok('logowanie nazwą (inna wielkość liter)', r.status === 200 && !!r.json.access_token, 'HTTP ' + r.status + ' ' + short(r.json));
ok('odpowiedź logowania nie zawiera e-maila', !JSON.stringify(r.json).includes(user.email));

r = await call('POST', '/functions/v1/login', { body: { username: user.username, password: 'zle-haslo-123' } });
ok('złe hasło → 401 invalid_credentials', r.status === 401 && r.json.error === 'invalid_credentials', short(r.json));

r = await call('POST', '/functions/v1/login', { body: { username: user.username.replace('_', 'X'), password: user.password } });
ok('„_” nie działa jak symbol wieloznaczny', r.status === 401, 'HTTP ' + r.status);

r = await call('POST', '/functions/v1/login', { body: { username: 'nie_ma_' + rnd, password: user.password } });
ok('nieznana nazwa → ta sama odpowiedź 401', r.status === 401 && r.json.error === 'invalid_credentials');

r = await call('POST', '/rest/v1/games', { token, body: { difficulty: 'medium', seed: 5 } });
ok('gra w toku', r.status === 201, 'HTTP ' + r.status);

const iso = m => new Date(Date.now() + m * 60000).toISOString();
const item = { difficulty: 'easy', seed: 4242, path: 'RD', moves: 2, elapsed_ms: 4000, hints_used: 0, status: 'won', started_at: iso(-5), finished_at: iso(-4) };
r = await call('POST', '/rest/v1/rpc/import_guest_games', { token, body: { items: [item] } });
ok('import wyniku gościa', r.status === 200 && r.json === 1, short(r.json));
r = await call('POST', '/rest/v1/rpc/import_guest_games', { token, body: { items: [item] } });
ok('ponowny import pomija duplikat', r.json === 0);
r = await call('POST', '/rest/v1/rpc/import_guest_games', { body: { items: [item] } });
ok('import bez logowania odrzucony', r.status >= 400, 'HTTP ' + r.status);

r = await call('GET', '/rest/v1/games?status=eq.playing&select=id', { token });
ok('import nie porzucił gry w toku', r.json.length === 1);
r = await call('GET', '/rest/v1/my_stats?select=*', { token });
ok('my_stats', r.status === 200 && Number(r.json[0].won) === 1, short(r.json));
r = await call('GET', '/rest/v1/my_best?select=*', { token });
ok('my_best', r.json[0]?.best_ms === 4000, short(r.json));

r = await call('PATCH', '/rest/v1/profiles?id=eq.' + uid, { token, body: { muted: true } });
ok('zmiana wyciszenia', r.status === 200 || r.status === 204, 'HTTP ' + r.status);
r = await call('PATCH', '/rest/v1/profiles?id=eq.' + uid, { token, body: { username: 'inna_nazwa' } });
ok('nazwy nie da się zmienić', r.status >= 400, 'HTTP ' + r.status);

console.log(fails ? `\n${fails} niepowodzeń` : '\nWszystko OK');
console.log('Konto testowe: ' + user.email);
process.exit(fails ? 1 : 0);
