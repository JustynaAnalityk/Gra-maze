// Zmiany w projekcie Supabase przez Management API, z sesji panelu, w której
// użytkowniczka SAMA się loguje w otwartym oknie Chrome. Token jest tylko w pamięci.
// Użycie: node supabase-admin.mjs sql ../supabase/migrations/X.sql auth-config deploy-login query "select 1" logout
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REF = 'tiyvaauexqvlgpyewirt';
const SITE = 'https://justynaanalityk.github.io/Gra-maze/';
const API = 'https://api.supabase.com/v1/projects/' + REF;
const here = path.dirname(fileURLToPath(import.meta.url));
const PROFILE = path.join(os.tmpdir(), 'nic-ariadny-supabase-admin');
const log = m => console.log(new Date().toLocaleTimeString('pl-PL') + ' ' + m);

const args = process.argv.slice(2);
if (!args.length) { console.log('Polecenia: sql <plik> | query "<SQL>" | auth-config | deploy-login | logout'); process.exit(1); }

async function getToken() {
  const ctx = await chromium.launchPersistentContext(PROFILE, { channel: 'chrome', headless: false, viewport: null });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://supabase.com/dashboard/project/' + REF, { waitUntil: 'commit', timeout: 0 }).catch(() => {});
  await page.bringToFront();
  log('Zaloguj się w otwartym oknie Chrome (czekam do 15 min)…');
  const deadline = Date.now() + 15 * 60000;
  let token = null;
  while (!token && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    token = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        try {
          const v = JSON.parse(localStorage.getItem(localStorage.key(i)));
          const t = v && (v.access_token || (v.currentSession && v.currentSession.access_token));
          if (typeof t === 'string' && t.split('.').length === 3) return t;
        } catch (e) { /* nie JSON */ }
      }
      return null;
    }).catch(() => null);
  }
  await ctx.close(); // zapis sesji na dysk przed wyjściem
  if (!token) throw new Error('Nie doczekałam się zalogowania.');
  log('Zalogowano – wykonuję polecenia.');
  return token;
}

async function api(token, method, url, body, isForm) {
  const headers = { Authorization: 'Bearer ' + token };
  if (body && !isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { method, headers, body: body ? (isForm ? body : JSON.stringify(body)) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(method + ' ' + url.replace(API, '') + ' → HTTP ' + res.status + ': ' + text.slice(0, 500));
  try { return JSON.parse(text); } catch { return text; }
}

const needsToken = args.some(a => ['sql', 'query', 'auth-config', 'deploy-login'].includes(a));
const token = needsToken ? await getToken() : null;
let code = 0;
for (let i = 0; i < args.length; i++) {
  const cmd = args[i];
  try {
    if (cmd === 'sql') {
      const file = path.resolve(args[++i]);
      await api(token, 'POST', API + '/database/query', { query: fs.readFileSync(file, 'utf8') });
      log('OK sql ' + path.basename(file));
    } else if (cmd === 'query') {
      const out = await api(token, 'POST', API + '/database/query', { query: args[++i] });
      log('OK query → ' + JSON.stringify(out).slice(0, 1000));
    } else if (cmd === 'auth-config') {
      await api(token, 'PATCH', API + '/config/auth', {
        external_anonymous_users_enabled: false,
        mailer_autoconfirm: true,          // bez potwierdzania maila przy rejestracji
        password_min_length: 8,
        site_url: SITE,
        uri_allow_list: SITE + ',' + SITE + '**'
      });
      log('OK auth-config');
    } else if (cmd === 'deploy-login') {
      const src = fs.readFileSync(path.join(here, '..', 'supabase', 'functions', 'login', 'index.ts'), 'utf8');
      const form = new FormData();
      form.append('metadata', JSON.stringify({ entrypoint_path: 'index.ts', name: 'login', verify_jwt: false }));
      form.append('file', new Blob([src], { type: 'application/typescript' }), 'index.ts');
      await api(token, 'POST', API + '/functions/deploy?slug=login', form, true);
      log('OK deploy-login');
    } else if (cmd === 'logout') {
      fs.rmSync(PROFILE, { recursive: true, force: true });
      log('OK logout – profil przeglądarki usunięty');
    } else {
      throw new Error('Nieznane polecenie: ' + cmd);
    }
  } catch (e) {
    code = 1;
    log('BŁĄD ' + cmd + ': ' + e.message);
  }
}
process.exit(code);
