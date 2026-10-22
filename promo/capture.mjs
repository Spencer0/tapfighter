// Records promo scenes from the real game: virtual 60fps clock, bot-played, pixel-exact PNG frames.
// usage: node capture.mjs <scene> <seconds> <outDir> [port]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire('/opt/node-tools/node_modules/');
const { chromium } = require('playwright');

const [scene, secs, outDir, port = '8765', knobs = '{}'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', e => console.error('PAGEERROR', e));
page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });

await page.addInitScript(() => {
  // Virtual clock: the game only advances when we say so.
  let now = 1000; let q = [];
  performance.now = () => now;
  window.requestAnimationFrame = cb => { q.push(cb); return q.length; };
  window.__adv = ms => { now += ms; const cbs = q; q = []; for (const cb of cbs) cb(now); };
  try { localStorage.clear(); localStorage.setItem('tapfighter.records.v1', JSON.stringify({ battles: 99, runs: 3, bestDepth: 9, bestLevel: 8 })); } catch {}
});
await page.addInitScript(k => Object.assign(window, JSON.parse(k)), knobs);
await page.goto(`http://localhost:${port}/index.html`);
await page.addScriptTag({ path: new URL('./bot.js', import.meta.url).pathname });
await page.evaluate(() => TFPromo.load());
await page.evaluate(() => window.__adv(16));
await page.evaluate(s => TFPromo.setup(s), scene);
const skip = await page.evaluate(() => TFPromo.skipSecs());
await page.evaluate(t => TFPromo.skipTo(t), skip);

const n = Math.round(+secs * 60);
for (let i = 0; i < n; i++) {
  const png = await page.evaluate(() => TFPromo.frame());
  fs.writeFileSync(path.join(outDir, `f${String(i).padStart(4, '0')}.png`), Buffer.from(png.split(',')[1], 'base64'));
}
const info = await page.evaluate(() => TFPromo.info());
const log = await page.evaluate(() => TFPromo.getLog());
fs.writeFileSync(path.join(outDir, 'events.json'), JSON.stringify(log, null, 1));
console.log(scene, 'done', JSON.stringify(info), `${log.length} cues`);
await browser.close();
