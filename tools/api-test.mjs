// Test obiektu Api w Chrome na żywym projekcie: rejestracja, gra, zapis, wznowienie, import, wylogowanie.
// Tworzy konto e2e.api*@mailinator.com – usuń je potem (zob. supabase/README.md).
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = `<!doctype html><meta charset="utf-8">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js"></script>
<script src="${pathToFileURL(path.join(root, 'js/supabase-config.js')).href}"></script>
<script src="${pathToFileURL(path.join(root, 'js/api.js')).href}"></script>`;
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto(pathToFileURL(path.join(root, 'index.html')).href); // origin file:// jak w grze
await page.setContent(html);
const rnd = Math.random().toString(36).slice(2, 8);
const out = await page.evaluate(async (rnd) => {
  const log = [];
  const ok = (n, c, x) => log.push((c ? 'OK   ' : 'FAIL ') + n + (x ? '  [' + x + ']' : ''));
  const err = async (p) => { try { await p; return null; } catch (e) { return e; } };
  ok('Api dostępne', Api.available());
  ok('init bez sesji', (await Api.init()) === null);
  const u = { username: 'a_' + rnd, email: 'e2e.api' + rnd + '@mailinator.com', password: 'Haslo-' + rnd + '!' };
  ok('nazwa wolna', await Api.usernameAvailable(u.username));
  let e = await err(Api.signUp({ ...u, password: 'krotkie' }));
  ok('krótkie hasło – polski komunikat', e && /8 znaków/.test(e.message), e && e.message);
  const user = await Api.signUp(u);
  ok('rejestracja', user && user.username === u.username && Api.user() === user);
  const id = await Api.startGame({ difficulty: 'easy', seed: 99 });
  await Api.saveGame(id, { path: 'R', moves: 1, elapsed_ms: 1500, hints_used: 1 });
  const playing = await Api.getPlayingGame();
  ok('gra w toku do wznowienia', playing && playing.id === id && playing.path === 'R' && playing.hints_used === 1, JSON.stringify(playing));
  await Api.finishGame(id, { path: 'R', moves: 1, elapsed_ms: 2000, hints_used: 1, status: 'gaveup' });
  ok('brak gry w toku po zakończeniu', (await Api.getPlayingGame()) === null);
  const iso = m => new Date(Date.now() + m * 60000).toISOString();
  const r = await Api.importGuestGames([
    { id: 'g1', difficulty: 'easy', seed: 7, path: 'D', moves: 1, elapsed_ms: 3000, hints_used: 0, status: 'won', started_at: iso(-3), finished_at: iso(-2) },
    { id: 'g2', difficulty: 'easy', seed: 8, path: 'D', moves: 9, elapsed_ms: 3000, hints_used: 0, status: 'won', started_at: iso(-3), finished_at: iso(-2) }
  ]);
  ok('import: 1 zapisany, 1 odrzucony, oba „done”', r.saved === 1 && r.done.join() === 'g1,g2', JSON.stringify(r));
  const best = await Api.getBest();
  ok('rekord z importu', best.easy && best.easy.best_ms === 3000, JSON.stringify(best));
  const stats = await Api.getStats();
  ok('statystyki', Number(stats.played) === 2 && Number(stats.won) === 1, JSON.stringify(stats));
  const hist = await Api.getHistory(10);
  ok('historia', hist.length === 2 && hist.every(h => h.status !== 'playing'));
  await Api.setMuted(true);
  ok('wyciszenie w profilu', Api.user().muted === true);
  await Api.signOut();
  ok('wylogowano', Api.user() === null);
  e = await err(Api.signIn(u.username, 'zle-haslo-123'));
  ok('złe hasło – komunikat', e && /Złe hasło/.test(e.message), e && e.message);
  const again = await Api.signIn(u.username.toUpperCase(), u.password);
  ok('logowanie nazwą', again && again.username === u.username && again.muted === true);
  await Api.signOut();
  ok('logowanie e-mailem', (await Api.signIn(u.email, u.password)).username === u.username);
  e = await err(Api.signUp({ ...u, email: 'e2e.api2' + rnd + '@mailinator.com' }));
  ok('zajęta nazwa – komunikat', e && /zajęta/.test(e.message), e && e.message);
  return log;
}, rnd);
out.forEach(l => console.log(l));
await browser.close();
const fails = out.filter(l => l.startsWith('FAIL')).length;
console.log(fails ? `\n${fails} niepowodzeń` : '\nWszystko OK');
process.exit(fails ? 1 : 0);
