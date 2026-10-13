// Przygotowuje lekkie wersje obrazka gry z img/zrodlo/justyna.png (1731×909):
//  - img/hero-1040.webp, img/hero-560.webp – wycinek z labiryntem (ilustracja w menu),
//  - img/tlo-960.webp – cały obrazek, mały (rozmyte tło ekranów konta i profilu),
//  - img/okladka.jpg – 1200×630, podgląd linku (og:image).
// Kodowanie robi Chrome (canvas.toDataURL), więc nie trzeba dodatkowych programów.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'img', 'zrodlo', 'justyna.png');
export const HERO_CROP = { x: 690, y: 0, w: 1041, h: 909 }; // labirynt z kłębkiem i bramą

const outputs = [
  { file: 'hero-1040.webp', crop: HERO_CROP, width: 1040, type: 'image/webp', q: 0.82 },
  { file: 'hero-560.webp', crop: HERO_CROP, width: 560, type: 'image/webp', q: 0.8 },
  { file: 'tlo-960.webp', crop: { x: 0, y: 0, w: 1731, h: 909 }, width: 960, type: 'image/webp', q: 0.7 },
  { file: 'okladka.jpg', crop: { x: 0, y: 0, w: 1731, h: 909 }, width: 1200, height: 630, type: 'image/jpeg', q: 0.86 }
];

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto(pathToFileURL(SRC).href);
for (const o of outputs) {
  const dataUrl = await page.evaluate(({ o }) => {
    const img = document.querySelector('img');
    const h = o.height || Math.round(o.crop.h * o.width / o.crop.w);
    const c = document.createElement('canvas');
    c.width = o.width;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, o.crop.x, o.crop.y, o.crop.w, o.crop.h, 0, 0, o.width, h);
    return c.toDataURL(o.type, o.q);
  }, { o });
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  fs.writeFileSync(path.join(root, 'img', o.file), buf);
  console.log(o.file.padEnd(16), Math.round(buf.length / 1024) + ' KB');
}
await browser.close();
