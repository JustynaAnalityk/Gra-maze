// Pełny scenariusz w Chrome: gość → wygrana → rejestracja z zapisem wyniku → wznawianie →
// logowanie nazwą i e-mailem → profil → zmiana hasła → tryb offline. Zrzuty do tools/out/.
// Tworzy konto e2e.ui*@mailinator.com – usuń je potem (zob. supabase/README.md).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const GAME = pathToFileURL(path.join(here, '..', 'index.html')).href;
const OUT = path.join(here, 'out');
fs.mkdirSync(OUT, { recursive: true });
const rnd = Math.random().toString(36).slice(2, 7);
const user = { username: 'e2e_' + rnd, email: 'e2e.ui' + rnd + '@mailinator.com', password: 'Haslo-' + rnd + '!', password2: 'Nowe-' + rnd + '!' };
let fails = 0;
const ok = (name, cond, extra) => { console.log((cond ? 'OK   ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); if (!cond) fails++; };
const KEYS = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];

// Reguła prawej ręki – w labiryncie idealnym zawsze dochodzi do mety. Kończy po maxSteps ruchach albo na ekranie wygranej.
async function walk(page, maxSteps) {
  const moves = async () => +(await page.textContent('#hud-moves'));
  let dir = 0, steps = 0;
  while (steps < maxSteps && await page.isHidden('#overlay')) {
    const before = await moves();
    for (const turn of [1, 0, 3, 2]) {
      const d = (dir + turn) % 4;
      await page.keyboard.press(KEYS[d]);
      await page.waitForTimeout(30); // licznik ruchów odświeża się w klatce animacji
      if (await moves() !== before) { dir = d; steps++; break; }
    }
  }
  return moves();
}
const status = page => page.textContent('#account-status');

const browser = await chromium.launch({ channel: 'chrome' });
const errors = [];
async function newPage(scheme = 'light', viewport = { width: 1200, height: 820 }) {
  const ctx = await browser.newContext({ colorScheme: scheme, viewport });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) console.log('     HTTP ' + r.status() + ' ' + r.request().method() + ' ' + r.url().replace(/\?.*/, '')); });
  return page;
}

// 1. Gość wygrywa
const page = await newPage();
await page.goto(GAME);
await page.waitForFunction(() => /gość/.test(document.getElementById('account-status').textContent));
ok('start jako gość', /Grasz jako gość/.test(await status(page)));
await page.click('[data-difficulty="easy"]');
await walk(page, 2000);
await page.waitForSelector('#overlay:not([hidden])');
ok('gość: wynik niezapisany', await page.isVisible('#ov-guest'));
await page.waitForTimeout(1000); await page.screenshot({ path: path.join(OUT, 'wygrana-gosc.png') });

// 2. „Zaloguj się, aby go zapisać” → rejestracja
await page.click('#ov-login');
ok('ekran konta z powodem', await page.isVisible('#auth-reason'));
await page.click('#tab-register');
await page.fill('#reg-username', user.username);
await page.waitForFunction(() => /wolna/.test(document.getElementById('reg-username-hint').textContent), null, { timeout: 10000 });
await page.fill('#reg-email', user.email);
await page.fill('#reg-password', user.password);
await page.fill('#reg-password2', user.password);
await page.waitForTimeout(1000); await page.screenshot({ path: path.join(OUT, 'rejestracja.png') });
await page.click('#form-register button[type=submit]');
ok('przed zaznaczeniem 18+ jest komunikat', /pełnoletnich/.test(await page.textContent('#register-error')));
await page.check('#reg-adult');
await page.click('#form-register button[type=submit]');
await page.waitForFunction(() => /Zalogowano/.test(document.getElementById('account-status').textContent), null, { timeout: 15000 });
await page.waitForFunction(() => /Zapisano 1 wynik/.test(document.getElementById('toast').textContent), null, { timeout: 15000 });
ok('wynik gościa zapisany po rejestracji', true);
await page.waitForFunction(() => /Rekord: \d/.test(document.querySelector('[data-best="easy"]').textContent));
ok('rekord bez dopisku „niezapisany”', !/niezapisany/.test(await page.textContent('[data-best="easy"]')));

// 3. Wznawianie po odświeżeniu strony (i Esc tuż po ruchu – Review Focus 2)
await page.click('[data-difficulty="medium"]');
await walk(page, 6);
await page.waitForTimeout(3500); // autozapis
await walk(page, 2);
await page.keyboard.press('Escape'); // esc-po-ruchu: ostatnie 2 ruchy muszą się zapisać
await page.waitForSelector('#btn-resume:not([hidden])', { timeout: 10000 });
ok('esc-po-ruchu: „Wznów” z 8 ruchami', /8 ruchów/.test(await page.textContent('#btn-resume')), await page.textContent('#btn-resume'));
await page.reload();
await page.waitForSelector('#btn-resume:not([hidden])', { timeout: 15000 });
ok('po odświeżeniu „Wznów: Średni”', /Wznów: Średni/.test(await page.textContent('#btn-resume')));
await page.waitForTimeout(1000); await page.screenshot({ path: path.join(OUT, 'menu-wznow.png') });
await page.click('#btn-resume');
ok('wznowiona gra ma 8 ruchów', (await page.textContent('#hud-moves')) === '8');
const t = await page.textContent('#hud-time');
ok('wznowiona gra zachowała czas', t !== '0:00.0', t);
await page.waitForTimeout(1000); await page.screenshot({ path: path.join(OUT, 'gra-wznowiona.png') });
await page.keyboard.press('Escape');

// 4. Wylogowanie, złe hasło, logowanie nazwą
await page.click('#btn-logout');
await page.waitForFunction(() => /gość/.test(document.getElementById('account-status').textContent));
await page.click('#btn-login');
await page.fill('#login-id', user.username.toUpperCase());
await page.fill('#login-password', 'zle-haslo-123');
await page.click('#form-login button[type=submit]');
await page.waitForSelector('#login-error:not([hidden])', { timeout: 10000 });
ok('złe hasło – komunikat', /Złe hasło/.test(await page.textContent('#login-error')));
await page.fill('#login-password', user.password);
await page.click('#form-login button[type=submit]');
await page.waitForFunction(() => /Zalogowano/.test(document.getElementById('account-status').textContent), null, { timeout: 15000 });
ok('logowanie nazwą (wielkie litery)', true);

// 5. Profil, zmiana hasła
await page.click('#btn-profile');
await page.waitForFunction(() => document.getElementById('st-played').textContent !== '–', null, { timeout: 10000 });
ok('profil: nazwa i e-mail', (await page.textContent('#profile-name')) === user.username && (await page.textContent('#profile-email')) === user.email);
ok('profil: 1 wygrana', (await page.textContent('#st-won')) === '1');
ok('profil: historia ma wygraną', /wygrana/.test(await page.textContent('#profile-history')));
await page.waitForTimeout(1000); await page.screenshot({ path: path.join(OUT, 'profil-jasny.png'), fullPage: true });
await page.fill('#cp-password', user.password2);
await page.fill('#cp-password2', user.password2);
await page.click('#form-changepass button[type=submit]');
await page.waitForSelector('#cp-ok:not([hidden])', { timeout: 10000 });
ok('zmiana hasła', true);
await page.click('#profile-logout');
await page.click('#btn-login');
await page.fill('#login-id', user.email);
await page.fill('#login-password', user.password2);
await page.click('#form-login button[type=submit]');
await page.waitForFunction(() => /Zalogowano/.test(document.getElementById('account-status').textContent), null, { timeout: 15000 });
ok('logowanie e-mailem nowym hasłem', true);

// 5b. Poprawki po recenzji (zalogowany gracz)
const toMs = s => { const m = /(\d+):(\d+)\.(\d)/.exec(s || ''); return m ? (+m[1] * 60 + +m[2]) * 1000 + +m[3] * 100 : 0; };
const resumeText = () => page.textContent('#btn-resume');

// (1) Czas spędzony bez ruchu też się zapisuje
await page.click('[data-difficulty="medium"]');
await walk(page, 3);
await page.waitForTimeout(3500); // autozapis po ruchach
await page.waitForTimeout(4000); // gracz myśli – bez ruchu
const idleT = toMs(await page.textContent('#hud-time'));
await page.keyboard.press('Escape');
await page.waitForSelector('#btn-resume:not([hidden])', { timeout: 10000 });
const resumeT = toMs((await resumeText()).split('·')[1]);
ok('czas bez ruchu zapisany przy wyjściu', resumeT >= idleT - 500, resumeT + ' ms, a w grze było ' + idleT + ' ms');

// (2) Nieudany start gry w bazie jest ponawiany
let blockedStart = false;
await page.route('**/rest/v1/games*', (route, req) => {
  if (!blockedStart && req.method() === 'POST') { blockedStart = true; return route.abort(); }
  return route.continue();
});
await page.click('[data-difficulty="easy"]');
await walk(page, 3);
await page.waitForTimeout(7000); // ponowienie startu po 5 s, potem zapis ruchów
await page.keyboard.press('Escape');
await page.waitForSelector('#btn-resume:not([hidden])', { timeout: 10000 });
ok('nieudany start gry jest ponawiany', blockedStart && /Łatwy .* 3 ruchy/.test(await resumeText()), await resumeText());
await page.unroute('**/rest/v1/games*');

// (3) Nieudany zapis wygranej nie zostawia gry „do wznowienia” ani podwójnej wygranej
let blockedFinish = false;
await page.route('**/rest/v1/games*', (route, req) => {
  if (!blockedFinish && req.method() === 'PATCH' && /"status":"won"/.test(req.postData() || '')) { blockedFinish = true; return route.abort(); }
  return route.continue();
});
await page.click('[data-difficulty="easy"]');
await walk(page, 2000);
await page.waitForSelector('#overlay:not([hidden])');
await page.waitForTimeout(1500);
await page.unroute('**/rest/v1/games*');
await page.click('#ov-menu');
await page.waitForTimeout(4000);
ok('nieudany zapis wygranej: brak „Wznów” dla wygranej gry', blockedFinish && await page.isHidden('#btn-resume'),
  (await page.isHidden('#btn-resume')) ? '' : await resumeText());
await page.click('#btn-profile');
await page.waitForFunction(() => document.getElementById('st-played').textContent !== '–', null, { timeout: 10000 });
ok('nieudany zapis wygranej: wygrana policzona raz (razem 2)', (await page.textContent('#st-won')) === '2',
  await page.textContent('#st-won') + ' | ' + JSON.stringify(await page.evaluate(() => Api.getHistory(6).then(h => h.map(g => g.difficulty + ':' + g.status + ':' + g.moves)))));
await page.click('#profile-back');

// 6. Pisanie w polach nie steruje grą (Review Focus 1)
await page.click('#btn-logout');
await page.click('#btn-login');
const mutedBefore = await page.getAttribute('#btn-mute', 'aria-pressed');
await page.fill('#login-id', 'wasdmhr');
ok('pole loginu przyjmuje litery w/a/s/d/m/h/r', (await page.inputValue('#login-id')) === 'wasdmhr');
ok('litera m w polu nie przełącza dźwięku', (await page.getAttribute('#btn-mute', 'aria-pressed')) === mutedBefore);

// 7. Wygląd: ciemny motyw i telefon
const dark = await newPage('dark');
await dark.goto(GAME);
await dark.click('#btn-login');
await dark.waitForTimeout(1000); await dark.screenshot({ path: path.join(OUT, 'logowanie-ciemny.png') });
const phone = await newPage('light', { width: 390, height: 844 });
await phone.goto(GAME);
await phone.waitForTimeout(1000); await phone.screenshot({ path: path.join(OUT, 'menu-telefon.png') });
await phone.click('#btn-login');
await phone.click('#tab-register');
await phone.waitForTimeout(1000); await phone.screenshot({ path: path.join(OUT, 'rejestracja-telefon.png') });

// 8. Offline: CDN Supabase nieosiągalny (Review Focus 4)
const off = await newPage();
await off.route('**/cdn.jsdelivr.net/**', r => r.abort());
await off.goto(GAME);
await off.waitForFunction(() => /Brak połączenia/.test(document.getElementById('account-status').textContent), null, { timeout: 12000 }).catch(() => {});
ok('offline: komunikat w menu', /Brak połączenia/.test(await status(off)), await status(off));
ok('offline: brak przycisku logowania', await off.isHidden('#btn-login'));
await off.click('[data-difficulty="easy"]');
await walk(off, 2000);
await off.waitForSelector('#overlay:not([hidden])');
ok('offline: wygrana trafia do kolejki gościa', await off.evaluate(() => GuestResults.count() === 1));

// 9. Wolna sieć: serwer bibliotek nie odpowiada wcale – gra nie może czekać na Supabase
const slow = await newPage();
await slow.route('**/cdn.jsdelivr.net/**', () => { /* brak odpowiedzi */ });
await slow.goto(GAME, { waitUntil: 'commit' });
await slow.waitForTimeout(3000);
await slow.click('[data-difficulty="easy"]', { timeout: 2000 }).catch(() => {});
ok('wolna sieć: gra rusza bez czekania na Supabase', await slow.isVisible('#game'));
await slow.keyboard.press('Escape');
await slow.waitForFunction(() => /Brak połączenia/.test(document.getElementById('account-status').textContent), null, { timeout: 12000 }).catch(() => {});
ok('wolna sieć: po chwili komunikat „Brak połączenia”', /Brak połączenia/.test(await status(slow)), await status(slow));

// „Failed to load resource” to wpis przeglądarki o odpowiedzi HTTP (np. celowe złe hasło → 401), nie błąd kodu.
const ownErrors = errors.filter(e => !/supabase|ERR_FAILED|net::|Failed to load resource/i.test(e));
ok('brak błędów JavaScript', ownErrors.length === 0, ownErrors.join(' | '));
await browser.close();
console.log(fails ? `\n${fails} niepowodzeń` : '\nWszystko OK');
console.log('Konto testowe: ' + user.email + '   Zrzuty: ' + OUT);
process.exit(fails ? 1 : 0);
