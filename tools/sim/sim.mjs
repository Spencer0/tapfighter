// Headless balance simulator: plays full runs of the real game with a simulated player.
//
//   node tools/sim/sim.mjs                      # 90%, 80% and 50% accuracy, 200 runs each
//   node tools/sim/sim.mjs --acc 0.8 --runs 500 --seed 7 --jobs 8
//   node tools/sim/sim.mjs --acc 0.9 --runs 1 --verbose   # one run, floor by floor
//
// Each run is seeded from (seed, accuracy, run index), so results replay exactly.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';

const FRAME = 1 / 60; // combat runs at 60fps like a phone
const EXPLORE_DT = 0.06; // two frames per step while walking
const MAX_GAME_SECONDS = +(process.env.SIM_MAX || 4 * 3600);

function hash(...xs) {
  let h = 2166136261;
  for (const x of xs) { h ^= Math.round(x * 1e6); h = Math.imul(h, 16777619); h ^= h >>> 13; }
  return h >>> 0;
}

async function worker() {
  const { clock, seedRandom } = await import('./shim.mjs');
  const { G, setScene } = await import('../../src/engine.js');
  const { buildSprites } = await import('../../src/sprites.js');
  const { rand } = await import('../../src/rng.js');
  const { newRun } = await import('../../src/state.js');
  const { Explore } = await import('../../src/explore.js');
  const { Combat } = await import('../../src/combat.js');
  const { Player } = await import('./player.mjs');
  const { BAL } = await import('../../src/data.js');
  Object.assign(BAL, workerData.set);
  G.W = 234; G.H = 507; // a 390x844 phone at the game's pixel scale
  buildSprites();

  const swap = next => { G.scene?.exit?.(); G.scene = next; next.enter?.(); next.resize?.(); };

  function playRun(acc, seed, verbose) {
    seedRandom(seed);
    rand.s = hash(seed, 1);
    const bot = new Player(acc, hash(seed, 2));
    bot.env = { G, clock };
    G.scene = null; G.trans = null; G.time = 0;
    const run = newRun();
    swap(new Explore(run));
    const out = { acc, seed, won: false, depth: 1, level: 1, killer: null, fights: 0, secs: 0, floors: [] };
    let fightsAt = 0, lastScene = null, floorT = 0, curDepth = 1, combatHp0 = 0, foe = null;
    let idleTicks = 0;
    while (G.time < MAX_GAME_SECONDS) {
      const sc = G.scene;
      const inCombat = sc instanceof Combat;
      const dt = inCombat ? FRAME : EXPLORE_DT;
      G.frameNow = clock.now = G.time * 1000;
      G.time += dt;
      if (G.trans) { const tr = G.trans; G.trans = null; swap(tr.next); continue; }
      sc.update(dt);
      if (G.trans) continue;
      if (inCombat) {
        if (lastScene !== sc) { lastScene = sc; out.fights++; combatHp0 = run.hp; foe = sc.def.name; }
        bot.combatTick(sc);
        if (sc.phase === 'defeat') { out.killer = sc.def.name + (sc.def.boss ? ' (boss)' : ''); break; }
        continue;
      }
      if (!(sc instanceof Explore)) continue; // floor-change interstitial
      if (run.depth !== curDepth) {
        if (verbose) console.log(`floor ${curDepth} cleared: lvl ${run.level} hp ${run.hp}/${run.maxHp} pots ${run.potions} gold ${run.gold} weapons ${run.weapons.map(w => `${w.base}${w.lvl}/${w.rarity}${w.affixes.length ? '+' + w.affixes.join('+') : ''}`).join(',')}`);
        out.floors.push({ depth: curDepth, secs: Math.round(G.time - floorT) });
        floorT = G.time; curDepth = run.depth;
      }
      if (sc.modal) { idleTicks = 0; if (bot.handleModal(sc) === 'won') { out.won = true; break; } continue; }
      if (sc.inCombat) continue;
      const p = sc.player;
      if (process.env.SIM_TRACE && G.time > MAX_GAME_SECONDS - 4) console.log('T', p.x, p.y, p.t, p.path.length, sc.autoGoal, JSON.stringify(p.path.slice(0, 3)), JSON.stringify(sc.ents.filter(e => e.kind === 'enemy' && Math.abs(e.x - p.x) < 8 && Math.abs(e.y - p.y) < 8).map(e => [e.type, e.x, e.y, e.awake, e.stun])));
      if (p.t < 1 || p.path.length || sc.auto) { idleTicks = 0; continue; }
      bot.exploreTick(sc);
      if (++idleTicks > 200 || (bot.stuck || 0) > 50) { out.killer = 'STUCK'; break; }
    }
    if (G.time >= MAX_GAME_SECONDS) {
      out.killer = 'TIMEOUT';
      const sc = G.scene;
      const p = sc.player;
      out.where = { scene: sc.constructor.name, phase: sc.phase, modal: sc.modal && sc.modal.title, depth: run.depth, auto: sc.auto,
        goal: sc.autoGoal, pos: p && [p.x, p.y], path: p && p.path.length, foe: sc.def && sc.def.name, hp: run.hp };
      if (verbose) console.log('TIMEOUT', JSON.stringify(out.where));
    }
    out.depth = run.depth; out.level = run.level; out.secs = Math.round(G.time);
    out.stats = bot.stats; out.bless = run.bless; out.potionsLeft = run.potions;
    out.weapons = run.weapons.map(w => w.base);
    return out;
  }

  const { jobs, verbose } = workerData;
  for (const j of jobs) parentPort.postMessage(playRun(j.acc, j.seed, verbose));
}

function parseArgs() {
  const a = { acc: [0.9, 0.8, 0.5], runs: 200, seed: 1, jobs: availableParallelism(), verbose: false, json: false, set: {} };
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) {
    const k = v[i];
    if (k === '--acc') a.acc = v[++i].split(',').map(Number);
    else if (k === '--runs') a.runs = +v[++i];
    else if (k === '--seed') a.seed = +v[++i];
    else if (k === '--jobs') a.jobs = +v[++i];
    else if (k === '--verbose') a.verbose = true;
    else if (k === '--json') a.json = true;
    else if (k === '--set') for (const kv of v[++i].split(',')) { const [key, val] = kv.split('='); a.set[key] = +val; } // e.g. --set foeDmg=1.2,potionCooldown=5000
    else if (k === '--only') a.only = +v[++i]; // replay one run by its seed
  }
  return a;
}

function summarize(acc, rs) {
  const n = rs.length, wins = rs.filter(r => r.won).length;
  const p = wins / n, ci = 1.96 * Math.sqrt((p * (1 - p)) / n);
  const deaths = {};
  for (const r of rs) if (!r.won) deaths[r.killer] = (deaths[r.killer] || 0) + 1;
  const byDepth = new Array(16).fill(0);
  for (const r of rs) if (!r.won) byDepth[Math.min(15, r.depth)]++;
  const sum = k => rs.reduce((s, r) => s + r.stats[k], 0);
  const med = xs => { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  console.log(`\n=== accuracy ${Math.round(acc * 100)}%: ${wins}/${n} wins = ${(p * 100).toFixed(1)}% (+/-${(ci * 100).toFixed(1)})`);
  console.log(`  landed ${(sum('landed') / sum('inputs') * 100).toFixed(1)}% of ${sum('inputs')} inputs, perfect ${(sum('perfect') / sum('inputs') * 100).toFixed(1)}%, runes ${sum('runes')}/${sum('runeTries')} traces`);
  console.log(`  median floor reached ${med(rs.map(r => r.depth))}, median level ${med(rs.map(r => r.level))}, potions drunk ${(sum('potions') / n).toFixed(1)} in fights + ${(sum('potionsOut') / n).toFixed(1)} outside per run`);
  const pct = (xs, q) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(q * (s.length - 1))]; };
  const lows = rs.map(r => r.stats.minHp);
  console.log(`  lowest HP in a run (share of max): p10 ${(pct(lows, 0.1) * 100).toFixed(0)}%  median ${(pct(lows, 0.5) * 100).toFixed(0)}%  p90 ${(pct(lows, 0.9) * 100).toFixed(0)}%; damage taken ${Math.round(sum('dmgTaken') / n)} per run`);
  const src = {};
  for (const r of rs) for (const [k, v] of Object.entries(r.stats.src || {})) src[k] = (src[k] || 0) + v;
  const tot = Object.values(src).reduce((a, b) => a + b, 0) || 1;
  console.log(`  damage from: ${Object.entries(src).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round((v / tot) * 100)}%`).join(', ')}`);
  console.log(`  deaths by floor: ${byDepth.map((c, d) => (c ? `F${d}:${c}` : '')).filter(Boolean).join(' ')}`);
  console.log(`  killers: ${Object.entries(deaths).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, c]) => `${k} ${c}`).join(', ')}`);
  const won = rs.filter(r => r.won);
  if (won.length) console.log(`  winning runs: median ${Math.round(med(won.map(r => r.secs)) / 60)} min game time, level ${med(won.map(r => r.level))}`);
}

async function main() {
  const a = parseArgs();
  const all = [];
  for (const acc of a.acc) for (let i = 0; i < a.runs; i++) all.push({ acc, seed: hash(a.seed, acc, i) });
  if (a.only) all.splice(0, all.length, ...a.acc.map(acc => ({ acc, seed: a.only })));
  const nw = Math.min(a.jobs, all.length);
  const chunks = Array.from({ length: nw }, () => []);
  all.forEach((j, i) => chunks[i % nw].push(j));
  const results = [];
  const t0 = Date.now();
  if (Object.keys(a.set).length && !a.json) console.log('overrides', JSON.stringify(a.set));
  await Promise.all(chunks.map(jobs => new Promise((res, rej) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { jobs, verbose: a.verbose, set: a.set } });
    w.on('message', r => {
      results.push(r);
      if (!a.verbose && process.stderr.isTTY) process.stderr.write(`\r${results.length}/${all.length} runs`);
    });
    w.on('error', rej);
    w.on('exit', res);
  })));
  if (process.stderr.isTTY) process.stderr.write('\n');
  if (a.json) { console.log(JSON.stringify(results)); return; }
  for (const acc of a.acc) summarize(acc, results.filter(r => r.acc === acc));
  console.log(`\n${results.length} runs in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

if (isMainThread) main(); else worker();
