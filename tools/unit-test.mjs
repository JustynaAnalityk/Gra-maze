// Otwiera tests.html w Chrome (bez okna) i wypisuje wynik. Kod wyjścia 1 = coś nie przeszło.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(pathToFileURL(path.join(root, 'tests.html')).href);
await page.waitForFunction(() => /^(OK|FAIL)/.test(document.title), null, { timeout: 30000 });
const summary = await page.textContent('#summary');
const failed = await page.$$eval('#results .fail', els => els.map(e => e.innerText));
console.log(summary);
failed.forEach(f => console.log('  ' + f.replace(/\n/g, '\n    ')));
errors.forEach(e => console.log('BŁĄD STRONY: ' + e));
await browser.close();
process.exit(failed.length || errors.length ? 1 : 0);
