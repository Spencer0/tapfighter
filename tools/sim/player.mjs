// A simulated player for balance testing. It plays whole runs through the game's real scenes:
// autoexplore, fights, loot, merchants, altars, level-ups and stairs, the way a person would.
//
// Skill is one number, `acc`: the share of timed taps that land, measured on the Short Sword's
// +/-170ms window. It is split into two human failure modes:
//   - timing spread: every tap is off by a normal error with sigma 40-90ms (worse players are
//     sloppier), widened when one thumb has to jump between marks in quick succession;
//   - lapses: whole inputs that get missed (didn't see it, wrong spot, panicked).
// Because spread is modelled separately, window sizes matter the way they do for people: tight
// weapons (crossbow, hammer) land less often, Keen/Steady blessings help, perfects are rarer
// than hits. A 100%-accuracy player never misses an input but still lands some GOODs.
import { RNG } from '../../src/rng.js';
import { WEAPONS, BLESSINGS, weaponStats, potionHeal, HERO_REST, tempoAt, ENEMIES, themeFor, scaleEnemy } from '../../src/data.js';
import { RHYTHM_GOOD, RHYTHM_PERFECT } from '../../src/rhythm.js';

const REF_GOOD = WEAPONS.sword.good;
const RUSH = 200; // ms: one thumb hitting two spots faster than this gets sloppier

// Standard normal CDF via erf (Abramowitz-Stegun 7.1.26).
function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
const pWithin = (w, sigma) => erf(w / (sigma * Math.SQRT2)); // P(|N(0, sigma)| <= w)

export function profile(acc) {
  const sigma = 40 + 50 * (1 - acc);
  const lapse = Math.max(0, Math.min(1, 1 - acc / pWithin(REF_GOOD, sigma)));
  return { acc, sigma, lapse };
}

export class Player {
  constructor(acc, seed) {
    this.p = profile(acc);
    this.rng = new RNG(seed);
    this.stats = { inputs: 0, landed: 0, perfect: 0, potions: 0, potionsOut: 0, runeTries: 0, runes: 0, dmgTaken: 0, minHp: 1 };
    this.plans = new WeakMap();
    this.lastTap = { L: -1e9, R: -1e9 };
    this.seenWeapons = new Set();
    this.visited = new Set();
  }

  gauss() { // Box-Muller
    let u = 0, v = 0;
    while (u === 0) u = this.rng.next();
    while (v === 0) v = this.rng.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // Timing error for a tap aimed at time T by one thumb.
  err(thumb, T) {
    const since = T - this.lastTap[thumb];
    const rush = since < RUSH ? 1 + 0.8 * (1 - Math.max(0, since) / RUSH) : 1;
    this.lastTap[thumb] = T;
    return this.gauss() * this.p.sigma * rush;
  }

  // ---------- Combat ----------
  combatTick(c) {
    const run = c.run;
    this.stats.minHp = Math.min(this.stats.minHp, run.hp / run.maxHp);
    if (!c.__tracked) {
      c.__tracked = true;
      // Tag each hit with what caused it, for the damage breakdown.
      const src = this.stats.src || (this.stats.src = {});
      let cur = null;
      const wrap = (name, tag) => { const f = c[name].bind(c); c[name] = (...a) => { const prev = cur; cur = tag(...a); try { return f(...a); } finally { cur = prev; } }; };
      wrap('updateFight', () => 'orb');
      wrap('updateRhythm', () => 'rhythm miss');
      wrap('autoResolve', m => (m.kind === 'guard' ? 'guard missed' : m.kind === 'rune' ? 'curse rune' : m.kind));
      wrap('guard', (m, grade) => (grade === 'good' ? 'block' : 'guard mistimed'));
      wrap('resolve', m => (m.kind === 'feint' ? 'feint tapped' : cur));
      const hurt = c.hurt.bind(c);
      c.hurt = (dmg, blocked) => {
        if (!c.over) { const d = Math.min(dmg, run.hp); this.stats.dmgTaken += d; const k = cur || 'other'; src[k] = (src[k] || 0) + d; }
        hurt(dmg, blocked);
      };
    }
    if (c.phase === 'intro' && !this.equippedFor) { this.equippedFor = c; this.equipBest(c); }
    if (c.phase === 'victory') { if (c.canLeave) { this.equippedFor = null; c.leave(); } return; }
    if (c.phase === 'fight') this.fightInputs(c);
    else if (c.phase === 'rhythm' && c.song) this.rhythmInputs(c);
    if (c.phase === 'fight' || c.phase === 'rhythm' || c.phase === 'pause') this.maybeDrink(c, run);
  }

  plan(m, fn) { let p = this.plans.get(m); if (!p) { p = fn(); this.plans.set(m, p); } return p; }

  // Taps land exactly at the planned time: performance.now() is set so the game's
  // between-frame correction lands the tap at T.
  tapAt(c, T, x, y) {
    this.env.clock.now = this.env.G.frameNow + (T - c.clock);
    c.onTap(x, y);
  }

  fightInputs(c) {
    const dt = 1000 / 60, t = c.clock, P = this.p;
    for (const m of c.marks) {
      if (m.done) continue;
      const pl = this.plan(m, () => {
        if (m.kind === 'rune') return this.planRune(m);
        if (m.kind === 'feint') {
          // Feints are "don't tap"; distracted players poke them about half as often as they lapse.
          const poke = this.rng.chance(P.lapse * 0.5);
          return poke ? { T: m.hitT + this.err('L', m.hitT) } : { T: null };
        }
        this.stats.inputs++;
        if (m.kind === 'orb') {
          if (this.rng.chance(P.lapse)) return { T: null };
          const react = 330 + 70 * Math.abs(this.gauss());
          this.stats.landed++;
          return { T: Math.min(m.hitT - 25, m.spawnT + react) };
        }
        if (this.rng.chance(P.lapse)) return { T: null };
        const thumb = m.kind === 'strike' ? 'R' : 'L';
        const e = this.err(thumb, m.hitT);
        const win = m.good;
        if (Math.abs(e) <= win) { this.stats.landed++; if (Math.abs(e) <= m.perfect) this.stats.perfect++; }
        if (e > win) return { T: null }; // too late: the mark resolves as a miss on its own
        return { T: m.hitT + e };
      });
      if (m.kind === 'rune') { this.runeStep(c, m, pl); continue; }
      if (pl.T == null || pl.fired) continue;
      if (pl.T <= t + dt) {
        pl.fired = true;
        const p = c.markPos(m, Math.max(pl.T, m.spawnT));
        this.tapAt(c, Math.max(pl.T, m.spawnT + 1), p.x, p.y);
        if (c.over) return;
      }
    }
  }

  // Runes: spot it, then trace; each attempt takes a while and can fizzle.
  planRune(m) {
    const acc = this.p.acc;
    const attempts = [];
    let at = m.spawnT + 350 + 80 * Math.abs(this.gauss());
    for (let i = 0; i < 6; i++) {
      at += Math.max(400, 750 + 600 * (1 - acc) + 150 * this.gauss());
      attempts.push({ at, pass: this.rng.chance(acc), perfect: this.rng.chance(0.2 + 0.4 * acc) });
    }
    return { attempts, i: 0 };
  }

  runeStep(c, m, pl) {
    const a = pl.attempts[pl.i];
    if (!a || c.clock < a.at) return;
    pl.i++;
    if (c.clock > m.hitT) return; // too slow: the curse already landed
    this.stats.runeTries++;
    if (a.pass) { this.stats.runes++; c.runeDone(m, a.perfect); } else m.tries++;
  }

  rhythmInputs(c) {
    const dt = 1000 / 60, t = c.clock, P = this.p, sg = c.song;
    const B = c.run.bless;
    const good = RHYTHM_GOOD + 15 * (B.keen || 0), perfect = RHYTHM_PERFECT + 10 * (B.steady || 0);
    const { hitY, lw } = c.rhythmGeom();
    for (const n of sg.notes) {
      if (n.done) continue;
      const pl = this.plan(n, () => {
        this.stats.inputs++;
        if (this.rng.chance(P.lapse)) return { T: null };
        const e = this.err(n.lane < 2 ? 'L' : 'R', n.t);
        if (Math.abs(e) <= good) { this.stats.landed++; if (Math.abs(e) <= perfect) this.stats.perfect++; }
        if (e > good) return { T: null };
        return { T: n.t + e };
      });
      if (pl.T == null || pl.fired) continue;
      if (pl.T <= t + dt) {
        pl.fired = true;
        this.tapAt(c, pl.T, (n.lane + 0.5) * lw, hitY);
        if (c.over) return;
      }
    }
  }

  // Drink as soon as a bottle would not be wasted, the cooldown is up and the left thumb has a
  // free moment. Below 25% HP, drink right away even if it costs a parry.
  maybeDrink(c, run) {
    if (run.potions <= 0 || c.clock < c.potionReady || c.over) return;
    const heal = potionHeal(run);
    const low = run.hp < run.maxHp * 0.25;
    if (!(run.maxHp - run.hp >= heal || low)) return;
    if (!low && !this.leftThumbFree(c)) return;
    const before = run.potions;
    c.drinkPotion();
    if (run.potions < before) this.stats.potions++;
  }

  leftThumbFree(c) {
    const t = c.clock;
    if (c.phase === 'rhythm' && c.song) return !c.song.notes.some(n => !n.done && n.lane < 2 && n.t > t - 50 && n.t < t + 350);
    return !c.marks.some(m => !m.done && (m.kind === 'guard' || m.kind === 'orb' || m.kind === 'rune') && m.hitT > t - 50 && m.hitT < t + 350);
  }

  // ---------- Weapons ----------
  // Expected damage per second against a foe, from this player's own hit/perfect odds.
  weaponDps(w, run, foe) {
    const s = weaponStats(w, run), P = this.p;
    const tempo = tempoAt(run.depth);
    if (foe.rhythm) return s.dmg * (foe.boss ? s.boss : 1) + s.heal * 2;
    const hit = pWithin(s.good, P.sigma) * (1 - P.lapse);
    const perf = pWithin(s.perfect, P.sigma) * (1 - P.lapse);
    const avgMul = 1 + 0.5 * (hit ? perf / hit : 0);
    const combo = 1 + Math.min(1, 6 * 0.06 * hit);
    let per = s.dmg * avgMul * 1.1 * combo * (foe.boss ? s.boss : 1);
    if (!s.pierce) per -= foe.armor;
    per = Math.max(1, per);
    const extra = 3 * s.burn + 4 * s.bleed + 0.7 * (s.heal + per * s.life);
    const volley = s.strikes * hit * (per + extra) * (1 + 0.15 * s.stun * perf);
    const ms = (150 + s.lead + (s.strikes - 1) * s.gap + s.good + HERO_REST) / tempo;
    return (volley / ms) * 1000;
  }

  // Overall worth of a weapon for the coming floors: mostly regular foes, partly the next boss.
  weaponValue(w, run) {
    const d = run.depth;
    const armor = 1 + Math.floor(d / 6) + (d > 10 ? 1.5 : 0.5);
    const boss = ENEMIES[themeFor(d).boss];
    const bossArmor = scaleEnemy(themeFor(d).boss, d).armor;
    return 0.75 * this.weaponDps(w, run, { armor, boss: false }) + 0.25 * this.weaponDps(w, run, { armor: bossArmor, boss: !!boss });
  }

  equipBest(c) {
    const run = c.run, f = c.foe;
    const foe = { armor: f.armor, boss: !!c.def.boss, rhythm: !!c.def.rhythm };
    let best = run.equipped, bv = -1;
    run.weapons.forEach((w, i) => { const v = this.weaponDps(w, run, foe); if (v > bv) { bv = v; best = i; } });
    if (best !== run.equipped) c.swap(best);
  }

  worstSlot(run) {
    let wi = 0, wv = 1e9;
    run.weapons.forEach((w, i) => { const v = this.weaponValue(w, run); if (v < wv) { wv = v; wi = i; } });
    return { i: wi, v: wv };
  }

  wants(w, run) { return run.weapons.length < 3 || this.weaponValue(w, run) > this.worstSlot(run).v * 1.05; }

  // ---------- Exploration / menus ----------
  blessingScore(id, run) {
    const a = this.p.acc, B = run.bless, n = B[id] || 0;
    const base = {
      vigor: 6, brutal: 7, undying: n ? 0 : 8, necro: 6, alchemy: 3 + run.potions, keen: 3 + 7 * (1 - a), steady: 3 + 2 * a,
      riposte: 5 * a, guard: 2 + 4 * (1 - a), bottle: 5, thorns: 4, leech: 3 * a, combo: 4 * a, runic: 2, greed: 2,
    }[id] ?? 1;
    return base / (1 + 0.3 * n);
  }

  handleModal(ex) {
    const m = ex.modal, run = ex.run;
    const t = m.title;
    if (t === 'VICTORY!') { this.won = true; return 'won'; }
    if (m.options && (t === 'LEVEL UP!' || t === 'BLESSED' || t === 'BLESSING')) {
      const opts = m.options;
      let bi = 0, bs = -1;
      opts.forEach((o, i) => {
        const b = BLESSINGS.find(b => o.title === b.name || o.title.startsWith(b.name + ' ('));
        const sc = b ? this.blessingScore(b.id, run) : 0;
        if (sc > bs) { bs = sc; bi = i; }
      });
      opts[bi].fn();
      return;
    }
    if (t === 'NEW WEAPON') {
      const w = m.weapon;
      this.seenWeapons.add(w.uid);
      if (!this.wants(w, run)) { (m.buttons.find(b => b.label.startsWith('LEAVE')) || m.buttons[0]).fn(); return; }
      if (m.options) m.options[this.worstSlot(run).i].fn();
      else m.buttons.find(b => b.label === 'TAKE').fn();
      return;
    }
    if (t === 'MERCHANT') { this.shop(ex, m); return; }
    if (t === 'BONE ALTAR') {
      const offer = run.maxHp >= 80 && run.hp >= run.maxHp * 0.5;
      m.buttons.find(b => b.label === (offer ? 'OFFER' : 'LEAVE')).fn();
      if (ex.modal === m) ex.closeModal();
      return;
    }
    if (t === 'DESCEND?') { m.buttons.find(b => b.label === (this.sideGoal(ex) ? 'STAY' : 'DESCEND')).fn(); return; }
    // Anything else (weapon info, menus): close it.
    if (m.buttons && m.buttons.length) m.buttons[0].fn(); else ex.closeModal();
  }

  shop(ex, m) {
    const run = ex.run;
    const e = this.shopEnt;
    const stock = e && e.stock;
    if (stock) {
      const buy = s => { if (!s.sold && run.gold >= s.price) { ex.buy(e, s); return true; } return false; };
      const w = stock.find(s => s.kind === 'weapon' && !s.sold);
      if (w && this.wants(w.weapon, run) && buy(w)) return; // a weapon dialog opens on top
      for (const s of stock) if (s.kind === 'potion' && run.potions < 4) if (buy(s)) return;
      const bl = stock.find(s => s.kind === 'blessing' && !s.sold);
      if (bl && buy(bl)) return;
      const el = stock.find(s => s.kind === 'elixir' && !s.sold);
      if (el && buy(el)) return;
      for (const s of stock) if (s.kind === 'potion') if (buy(s)) return;
    }
    m.buttons[0].fn();
  }

  // Called when the explore scene is idle (not moving, no modal).
  exploreTick(ex) {
    const run = ex.run, p = ex.player;
    if (run.hp < run.maxHp * 0.5 && run.potions > 0 && run.maxHp - run.hp >= potionHeal(run) * 0.8) {
      ex.usePotion(); this.stats.potionsOut++; return;
    }
    if (ex.auto) return;
    const known = e => ex.explored[ex.idx(e.x, e.y)];
    const goal = this.sideGoal(ex);
    if (goal) {
      if (this.walkTo(ex, goal)) { this.visited.add(goal.id); if (goal.kind === 'merchant') this.shopEnt = goal; return; }
      this.visited.add(goal.id); if (goal.kind === 'weapon') this.seenWeapons.add(goal.weapon.uid);
    }
    ex.toggleAuto();
    if (ex.auto) return;
    // Autoexplore gave up: the floor is done but a monster (a boss, or one in a doorway) is in the way.
    const foes = ex.ents.filter(e => e.kind === 'enemy' && known(e));
    foes.sort((a, b) => Math.max(Math.abs(a.x - p.x), Math.abs(a.y - p.y)) - Math.max(Math.abs(b.x - p.x), Math.abs(b.y - p.y)));
    for (const f of foes) {
      if (f.boss) while (run.potions > 0 && run.maxHp - run.hp >= potionHeal(run)) { ex.usePotion(); this.stats.potionsOut++; }
      if (this.walkTo(ex, f)) return;
    }
    this.stuck = (this.stuck || 0) + 1;
  }

  // Side trips autoexplore doesn't make on its own: loot worth a look, shops, altars, fountains.
  sideGoal(ex) {
    const run = ex.run;
    for (const e of ex.ents) {
      if (!ex.explored[ex.idx(e.x, e.y)] || this.visited.has(e.id)) continue;
      if (e.kind === 'weapon' && !this.seenWeapons.has(e.weapon.uid)) {
        if (this.wants(e.weapon, run)) return e;
        this.seenWeapons.add(e.weapon.uid);
      }
      if (e.kind === 'merchant' && run.gold >= 25 + run.depth * 3) return e;
      if (e.kind === 'altar' && !e.used && run.maxHp >= 80) return e;
      if (e.kind === 'fountain' && !e.used && run.hp < run.maxHp * 0.7) return e;
    }
    return null;
  }

  walkTo(ex, e) {
    const path = ex.findPath(e.x, e.y);
    if (!path || !path.length) return false;
    ex.player.path = path; ex.target = [e.x, e.y];
    return true;
  }
}
