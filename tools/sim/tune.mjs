// Hill-climbs the BAL knobs in src/data.js toward target win rates per accuracy.
//
//   node tools/sim/tune.mjs --iters 30 --runs 40
//   node tools/sim/tune.mjs --start foeDmg=0.8,potionCooldown=3000 --target 1:0.9,0.8:0.5,0.5:0.1
//
// Each candidate plays `runs` games per accuracy (common seeds, so candidates are compared on
// the same dungeons). Prints every improvement; the last line is the best --set string found.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BAL } from '../../src/data.js';

const SIM = fileURLToPath(new URL('./sim.mjs', import.meta.url));
const RANGES = {
  foeDmg: [0.5, 2], foeDmgPerFloor: [0.05, 0.8], foeHpPerFloor: [0.25, 0.7], hpPerLevel: [2, 12],
  guardPerfect: [30, 100], guardGood: [110, 200], blockAbsorb: [0.1, 0.7], rhythmMiss: [0.05, 0.3],
  potionHeal: [0.25, 0.7], potionCooldown: [800, 8000], potionDrop: [0.05, 0.6],
  comboCap: [0.2, 1], perfectMul: [1.1, 1.6],
};

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const iters = +opt('iters', 30), runs = +opt('runs', 40), seed = +opt('seed', 11);
const target = Object.fromEntries(opt('target', '1:0.9,0.8:0.5,0.5:0.1').split(',').map(p => p.split(':').map(Number)));
const accs = Object.keys(target).map(Number);
const keys = (opt('keys', '') || Object.keys(RANGES).join(',')).split(',');
let cur = { ...Object.fromEntries(keys.map(k => [k, BAL[k]])) };
for (const kv of opt('start', '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); cur[k] = +v; }

const fmt = c => Object.entries(c).map(([k, v]) => `${k}=${+(+v).toPrecision(3)}`).join(',');
function evaluate(c) {
  const out = execFileSync('node', [SIM, '--json', '--runs', String(runs), '--seed', String(seed), '--acc', accs.join(','), '--set', fmt(c)], { maxBuffer: 1 << 28 });
  const rs = JSON.parse(out);
  const win = {};
  for (const a of accs) { const r = rs.filter(x => x.acc === a); win[a] = r.filter(x => x.won).length / r.length; }
  const loss = accs.reduce((s, a) => s + (win[a] - target[a]) ** 2, 0);
  return { win, loss };
}
const show = w => accs.map(a => `${Math.round(a * 100)}%:${Math.round(w[a] * 100)}`).join(' ');

let best = evaluate(cur);
console.log(`start  loss ${best.loss.toFixed(3)}  ${show(best.win)}  ${fmt(cur)}`);
let step = 0.25;
for (let i = 0; i < iters; i++) {
  const cand = { ...cur };
  const n = 1 + Math.floor(Math.random() * 3);
  for (let j = 0; j < n; j++) {
    const k = keys[Math.floor(Math.random() * keys.length)];
    const [lo, hi] = RANGES[k];
    cand[k] = Math.min(hi, Math.max(lo, cand[k] + (Math.random() * 2 - 1) * step * (hi - lo)));
    if (k === 'guardPerfect' || k === 'guardGood' || k === 'potionCooldown') cand[k] = Math.round(cand[k]);
  }
  const r = evaluate(cand);
  const better = r.loss < best.loss;
  console.log(`${better ? 'BETTER' : 'iter  '} ${String(i + 1).padStart(2)} loss ${r.loss.toFixed(3)}  ${show(r.win)}${better ? '  ' + fmt(cand) : ''}`);
  if (better) { best = r; cur = cand; } else step = Math.max(0.06, step * 0.95);
}
console.log(`\nbest loss ${best.loss.toFixed(3)}  ${show(best.win)}\n--set ${fmt(cur)}`);
