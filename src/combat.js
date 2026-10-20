// Timing-based battle scene. Player phase: tap closing rings on the foe.
// Enemy phase: tap shields to parry, smash orbs, and leave skull feints alone.
// Runes: drag to trace curse glyphs before they land, and your own sigil after a flawless turn.
import { G, setScene, shake, flash } from './engine.js';
import { text } from './font.js';
import { SPR, weaponIcon } from './sprites.js';
import { disc, ring, ellipse, line, silhouette, pixelsOf, clamp, lerp } from './gfx.js';
import { ENEMIES, weaponStats, potionHeal, gainXp, goldMul, makeWeapon, weaponName, RARITY, RUNE_TIME, SIGIL_TIME, runeTime } from './data.js';
import { RUNES, gradeRune, drawRune } from './runes.js';
import { sfx, playMusic } from './audio.js';
import { rand } from './rng.js';
import * as ui from './ui.js';
import { makeBackdrop } from './backdrop.js';
import { bumpBattles } from './state.js';
import { GameOver } from './title.js';

const R_IN = 8;
const R_TAP = 23;

export class Combat {
  constructor(run, ent, explore) {
    this.run = run; this.ent = ent; this.explore = explore;
    this.def = ENEMIES[ent.type];
    this.theme = explore.theme;
    this.spr = SPR[ent.type];
    this.foe = { hp: ent.hp, maxHp: ent.maxHp, armor: ent.armor, dmg: ent.dmg, burn: 0, bleed: 0, stun: 0, ghost: ent.hp };
    this.marks = []; this.parts = []; this.pops = []; this.slashes = []; this.timers = [];
    this.clock = 0; this.phase = 'intro'; this.combo = 0; this.attackIdx = 0; this.bonus = 0;
    this.heroA = { lunge: 0, hurt: 0, swing: 0 };
    this.foeA = { flash: 0, knock: 0, lunge: 0, wind: 0 };
    this.heroGhost = run.hp;
    this.over = false; this.heroGone = false; this.foeGone = false;
    this.battleNo = bumpBattles();
    this.hints = this.battleNo <= 4;
    this.hint = null;
    this.banner = { text: this.def.name, sub: this.def.boss ? '- BOSS -' : 'ATTACKS!', t: 0, dur: this.def.boss ? 1.6 : 1.0 };
    this.after(this.def.boss ? 1600 : 1000, () => this.startPlayer());
  }

  enter() { playMusic(this.def.boss ? 'boss' : 'combat'); if (this.def.boss) sfx('boss'); }
  resize() { this.layout(); }

  layout() {
    const W = G.W, H = G.H;
    this.barY = H - G.safeBottom - ui.BAR_H;
    this.top = G.safeTop + 26;
    const arenaH = this.barY - 16 - this.top;
    this.arenaH = arenaH;
    this.zoom = Math.max(2, Math.min(5, Math.floor(Math.min(W / 56, arenaH / 100))));
    this.horizon = this.top + Math.floor(arenaH * 0.3);
    this.foeX = Math.floor(W * 0.64);
    this.foeY = this.top + Math.floor(arenaH * 0.55);
    this.heroX = Math.floor(W * 0.27);
    this.heroY = this.top + Math.floor(arenaH * 0.97);
    if (W > H) { this.foeX = Math.floor(W * 0.62); this.heroX = Math.floor(W * 0.32); }
    this.bg = makeBackdrop(this.theme, W, H, this.horizon);
  }

  after(ms, fn) { this.timers.push({ at: this.clock + ms, fn }); }

  foeRect() {
    const z = this.zoom, s = this.spr;
    const w = s.width * z, h = s.height * z;
    const fly = this.def.fly ? 16 : 0;
    return { x: this.foeX - w / 2, y: this.foeY - h - fly, w, h };
  }
  heroRect() {
    const z = this.zoom, s = SPR.hero;
    const w = s.width * z, h = s.height * z;
    return { x: this.heroX - w / 2, y: this.heroY - h, w, h };
  }

  // Choose a mark position inside rect, keeping distance from marks that overlap in time.
  spot(rect, hitT, lead, pref = null) {
    let best = null, bestD = -1;
    for (let i = 0; i < 30; i++) {
      const grow = i > 12 ? 12 : 0;
      let x, y;
      if (pref && i === 0) [x, y] = pref;
      else { x = rect.x + 4 - grow + rand.next() * (rect.w - 8 + grow * 2); y = rect.y + 4 - grow + rand.next() * (rect.h - 8 + grow * 2); }
      x = clamp(x, R_IN + 14, G.W - R_IN - 14);
      y = clamp(y, this.top + R_IN + 8, this.barY - 22);
      let dmin = 1e9;
      for (const m of this.marks) {
        if (m.done || m.kind === 'rune' || Math.abs(m.hitT - hitT) > lead + 120) continue;
        const p = this.markPos(m, m.hitT);
        dmin = Math.min(dmin, Math.hypot(p.x - x, p.y - y));
      }
      if (dmin >= 30) return [x, y];
      if (dmin > bestD) { bestD = dmin; best = [x, y]; }
    }
    return best;
  }

  markPos(m, t = this.clock) {
    if (m.kind === 'rune') return { x: m.x, y: m.y };
    if (m.kind === 'orb') {
      const p = clamp(1 - (m.hitT - t) / m.lead, 0, 1);
      return { x: lerp(m.sx, m.tx, p), y: lerp(m.sy, m.ty, p) - Math.sin(p * Math.PI) * 24 };
    }
    const dt = Math.max(0, t - m.spawnT) / 1000;
    return { x: m.x + m.vx * dt, y: m.y + m.vy * dt };
  }

  prompt(t, col) { this.promptT = { text: t, col, t: 0 }; }

  // ---------- Phases ----------
  startPlayer() {
    if (this.over) return;
    const w = this.run.weapons[this.run.equipped];
    const s = (this.ws = weaponStats(w, this.run));
    this.phase = 'player'; this.marks = []; this.phaseResolved = 0; this.phaseHits = 0; this.stroke = null;
    const n = s.strikes + this.bonus; this.bonus = 0;
    this.phaseStrikes = n; this.sigilOffered = false;
    const t0 = this.clock + 250 + s.lead;
    const r = this.foeRect();
    const head = [r.x + this.def.head[0] * r.w, r.y + this.def.head[1] * r.h];
    for (let i = 0; i < n; i++) {
      const hitT = t0 + i * s.gap;
      const crit = rand.chance(0.25);
      const [x, y] = this.spot(r, hitT, s.lead, crit ? head : null);
      this.marks.push({
        kind: 'strike', x, y, hitT, lead: s.lead, spawnT: hitT - s.lead, perfect: s.perfect, good: s.good, crit,
        vx: s.drift ? rand.range(-16, 16) : 0, vy: s.drift ? rand.range(-10, 10) : 0, done: false,
      });
    }
    this.prompt('STRIKE!', '#f0d050');
    if (this.hints) this.hint = 'TAP EACH RING AS IT CLOSES';
  }

  startEnemy() {
    if (this.over) return;
    this.marks = [];
    const f = this.foe;
    if (f.burn > 0) { this.damageFoe(f.burn * 2, '#e8822c', null, 'BURN'); f.burn = Math.floor(f.burn / 2); }
    if (!this.over && f.bleed > 0) { this.damageFoe(f.bleed * 2, '#d04040', null, 'BLEED'); f.bleed = Math.max(0, f.bleed - 1); }
    if (this.over) return;
    if (f.stun > 0) {
      f.stun--;
      this.pop('STUNNED!', this.foeX, this.foeRect().y - 6, '#f0d050', 2);
      sfx('stun');
      this.phase = 'pause';
      this.after(900, () => this.startPlayer());
      return;
    }
    const atks = this.def.attacks;
    const atk = this.def.boss ? atks[this.attackIdx++ % atks.length] : rand.pick(atks);
    const enraged = this.def.boss && f.hp < f.maxHp / 2;
    const lead = Math.round(atk.lead * (enraged ? 0.85 : 1));
    this.phase = 'enemy'; this.foeA.wind = 1; this.stroke = null;
    this.atkGuards = 0; this.atkParries = 0;
    const start = this.clock + 520;
    const B = this.run.bless;
    const hr = this.heroRect();
    const zone = { x: hr.x - 26, y: hr.y - 30, w: hr.w + 52, h: hr.h + 14 };
    const fr = this.foeRect();
    let hasFeint = false, hasOrb = false, hasRune = false;
    for (const h of atk.hits) {
      const hitT = start + lead + Math.round(h.t * (enraged ? 0.85 : 1));
      const dmg = Math.max(1, Math.round(f.dmg * atk.mul * (h.mul || 1)));
      if (h.type === 'rune') {
        hasRune = true;
        const win = Math.round(runeTime(this.run, RUNE_TIME) * (enraged ? 0.85 : 1));
        this.addRune('curse', rand.pick(h.runes), start + Math.round(h.t * (enraged ? 0.85 : 1)), win, dmg);
      } else if (h.type === 'orb') {
        hasOrb = true;
        this.marks.push({ kind: 'orb', sx: fr.x + fr.w / 2, sy: fr.y + fr.h * 0.45, tx: this.heroX + rand.range(-8, 8), ty: hr.y + hr.h * 0.4,
          hitT, lead, spawnT: hitT - lead, dmg, done: false });
      } else {
        if (h.type === 'feint') hasFeint = true; else this.atkGuards++;
        const [x, y] = this.spot(zone, hitT, lead);
        this.marks.push({ kind: h.type, x, y, hitT, lead, spawnT: hitT - lead, vx: 0, vy: 0, dmg,
          perfect: 95 + 25 * (B.steady || 0), good: 190 + 35 * (B.keen || 0), done: false });
      }
    }
    this.prompt(atk.name.toUpperCase() + (enraged ? '!!' : '!'), '#ff6050');
    if (hasRune) sfx('rune');
    if (this.hints) this.hint = hasRune ? 'DRAG TO TRACE THE RUNE BEFORE IT LANDS' : hasFeint ? "DON'T TAP SKULLS - THEY'RE FEINTS" : hasOrb ? 'TAP ORBS BEFORE THEY HIT YOU' : 'TAP SHIELDS ON TIME TO PARRY';
  }

  // A rune glyph to trace. owner 'curse' = enemy spell (fail = hit), 'sigil' = your bonus blast.
  addRune(owner, id, spawnT, win, dmg = 0) {
    const size = this.runeSize();
    this.marks.push({ kind: 'rune', owner, rune: id, x: Math.round(G.W / 2), y: Math.round(this.top + this.arenaH * 0.46),
      size, spawnT, hitT: spawnT + win, lead: win, good: 0, dmg, tries: 0, done: false });
  }
  runeSize() { return Math.round(Math.max(48, Math.min(G.W * 0.5, this.arenaH * 0.42, 120))); }
  activeRune(t = this.clock) { return this.marks.find(m => m.kind === 'rune' && !m.done && t >= m.spawnT); }

  endPhase() {
    const was = this.phase;
    this.phase = 'pause';
    if (was === 'enemy' && this.atkGuards > 0 && this.atkParries === this.atkGuards) {
      this.bonus = 1;
      this.pop('STAGGERED! +1 STRIKE', this.foeX, this.foeRect().y - 8, '#70d0e0', 1);
    }
    this.after(was === 'player' ? 450 : 520, () => (was === 'player' ? this.startEnemy() : this.startPlayer()));
  }

  // ---------- Resolution ----------
  onTap(x, y) {
    if (this.phase === 'victory') { if (this.canLeave) this.leave(); return; }
    if (this.phase !== 'player' && this.phase !== 'enemy') return;
    const tT = this.clock + Math.min(60, performance.now() - G.frameNow);
    let best = null, bs = 1e9;
    for (const m of this.marks) {
      if (m.done || tT < m.spawnT || m.kind === 'rune') continue;
      if (this.phase === 'player' && m.kind !== 'strike') continue;
      const p = this.markPos(m, tT);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d > (m.kind === 'orb' ? 20 : R_TAP)) continue;
      const sc = (m.kind === 'orb' ? 0 : Math.abs(tT - m.hitT)) + d * 3;
      if (sc < bs) { bs = sc; best = m; }
    }
    if (!best) {
      if (this.activeRune(tT)) { this.stroke = [[x, y]]; return; }
      if (this.phase === 'player' && this.marks.some(m => !m.done && tT >= m.spawnT)) {
        this.combo = 0;
        this.pop('WHIFF', x, y - 6, '#8a7a9a');
        sfx('whiff');
      }
      return;
    }
    this.resolve(best, tT);
  }

  onDrag(x, y) {
    const s = this.stroke;
    if (!s) return;
    const [lx, ly] = s[s.length - 1];
    if (Math.hypot(x - lx, y - ly) >= 1.5 && s.length < 400) s.push([x, y]);
  }

  onRelease(x, y) {
    const s = this.stroke;
    this.stroke = null;
    if (!s) return;
    this.onDrag(x, y);
    const m = this.activeRune();
    if (!m || this.over) return;
    // Ignore taps and tiny wiggles; only a real attempt counts.
    let len = 0;
    for (let i = 1; i < s.length; i++) len += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
    if (len < m.size * 0.6) return;
    const grade = gradeRune(s, m.rune, m.size * 0.3);
    this.trail = { pts: s, t: 0, ok: grade !== 'fail' };
    if (grade === 'fail') {
      m.tries++;
      this.pop('FIZZLE - AGAIN!', m.x, m.y + m.size / 2 + 6, '#8a7a9a');
      sfx('fizzle');
      return;
    }
    this.runeDone(m, grade === 'perfect');
  }

  runeDone(m, perfect) {
    m.done = true;
    const B = this.run.bless;
    const lore = 1 + 0.5 * (B.runic || 0);
    this.combo++;
    this.run.bestCombo = Math.max(this.run.bestCombo || 0, this.combo);
    this.burst(m.x, m.y, m.owner === 'curse' ? '#ff70c0' : '#f0d050', 24, 110);
    shake(perfect ? 4 : 2);
    if (m.owner === 'curse') {
      // The curse rebounds on its caster and ignores armor.
      this.pop(perfect ? 'PERFECT DISPEL!' : 'DISPELLED!', m.x, m.y - m.size / 2 - 8, '#ff90d0', perfect ? 2 : 1);
      sfx('dispel');
      this.damageFoe(Math.max(1, Math.round(m.dmg * 0.6 * (perfect ? 1.5 : 1) * lore)), '#ff90d0', null, 'BACKLASH');
    } else {
      const s = this.ws || weaponStats(this.run.weapons[this.run.equipped], this.run);
      const comboMul = 1 + Math.min(1, this.combo * 0.06 * (1 + 0.5 * (B.combo || 0)));
      const dmg = Math.round(s.dmg * 1.25 * (perfect ? 1.5 : 1) * comboMul * lore * (this.def.boss ? s.boss : 1));
      this.pop(perfect ? 'PERFECT SIGIL!' : 'SIGIL BLAST!', m.x, m.y - m.size / 2 - 8, '#f0d050', perfect ? 2 : 1);
      sfx('sigil');
      this.heroA.lunge = 1; this.heroA.swing = 1;
      flash('#f0d050', 0.15);
      this.damageFoe(Math.max(1, dmg), '#f0d050', { x: this.foeX, y: this.foeRect().y + this.foeRect().h / 2 }, 'SIGIL');
    }
  }

  resolve(m, tT) {
    m.done = true;
    const p = this.markPos(m, tT);
    if (m.kind === 'orb') {
      this.combo++;
      this.pop('SMASH!', p.x, p.y - 8, '#7ac040');
      this.burst(p.x, p.y, '#7ac040', 12, 60);
      sfx('smash');
      return;
    }
    if (m.kind === 'feint') {
      this.pop('FEINT!', p.x, p.y - 8, '#c070f0', 1);
      sfx('feint');
      this.combo = 0;
      this.foeA.lunge = 1;
      this.hurt(Math.max(1, Math.round(m.dmg * 0.6)));
      return;
    }
    const d = tT - m.hitT;
    const grade = d < -m.good ? 'early' : Math.abs(d) <= m.perfect ? 'perfect' : Math.abs(d) <= m.good ? 'good' : 'miss';
    if (m.kind === 'strike') this.strike(m, grade, p); else this.guard(m, grade, p);
  }

  autoResolve(m) {
    m.done = true;
    const p = this.markPos(m);
    if (m.kind === 'strike') { this.combo = 0; this.pop('MISS', p.x, p.y - 6, '#8a7a9a'); sfx('miss'); }
    else if (m.kind === 'guard') { this.foeA.lunge = 1; this.hurt(m.dmg); }
    else if (m.kind === 'feint') { this.pop('DODGED', p.x, p.y - 6, '#a898b0'); }
    else if (m.kind === 'rune') {
      if (m.owner === 'curse') {
        this.pop('CURSED!', m.x, m.y - m.size / 2 - 8, '#ff5080', 2);
        this.foeA.lunge = 1;
        this.hurt(m.dmg);
      } else this.pop('SIGIL FADES', m.x, m.y, '#8a7a9a');
    }
  }

  strike(m, grade, p) {
    this.phaseResolved++;
    if (grade === 'early' || grade === 'miss') {
      this.combo = 0;
      this.pop(grade === 'early' ? 'EARLY' : 'LATE', p.x, p.y - 6, '#8a7a9a');
      sfx('miss');
      return;
    }
    const s = this.ws, run = this.run, B = run.bless;
    const perfect = grade === 'perfect';
    this.phaseHits++;
    this.combo++;
    run.bestCombo = Math.max(run.bestCombo || 0, this.combo);
    const comboMul = 1 + Math.min(1, this.combo * 0.06 * (1 + 0.5 * (B.combo || 0)));
    let dmg = s.dmg * (perfect ? 1.5 : 1) * (m.crit ? 1.4 : 1) * comboMul * (this.def.boss ? s.boss : 1);
    if (!s.pierce) dmg -= this.foe.armor;
    dmg = Math.max(1, Math.round(dmg));
    this.heroA.lunge = 1; this.heroA.swing = 1;
    this.slashes.push({ x: p.x, y: p.y, t: 0, a: rand.range(-0.6, 0.6) - 0.8, big: perfect });
    this.pop(perfect ? (m.crit ? 'CRITICAL!' : 'PERFECT!') : 'GOOD', p.x, p.y - 14, perfect ? '#f0d050' : '#fffbea', perfect ? 1 : 1);
    sfx(perfect ? 'perfect' : 'good');
    shake(perfect ? 3 : 1);
    let heal = s.heal + Math.round(dmg * s.life) + (perfect && B.leech ? B.leech : 0);
    if (heal > 0) this.healHero(heal, true);
    if (s.burn) this.foe.burn += s.burn;
    if (s.bleed) this.foe.bleed += s.bleed;
    if (perfect && s.stun && this.foe.stun === 0 && rand.chance(s.stun)) {
      this.foe.stun = 1;
      this.pop('STUN!', this.foeX, this.foeRect().y - 4, '#f0d050');
    }
    this.damageFoe(dmg, perfect ? '#f0d050' : '#fffbea', p);
  }

  guard(m, grade, p) {
    this.foeA.lunge = 1;
    const B = this.run.bless;
    if (grade === 'perfect') {
      this.combo++; this.atkParries++;
      this.heroA.swing = 1;
      const ws = weaponStats(this.run.weapons[this.run.equipped], this.run);
      const counter = Math.max(1, Math.round(ws.dmg * 0.6 * (B.riposte ? 2 : 1)));
      this.pop('PARRY!', p.x, p.y - 12, '#70d0e0', 1);
      this.burst(p.x, p.y, '#fffbea', 10, 90);
      sfx('parry'); shake(2);
      this.damageFoe(counter, '#70d0e0', null);
    } else if (grade === 'good') {
      const red = Math.min(0.9, 0.6 + 0.15 * (B.guard || 0));
      this.pop('BLOCK', p.x, p.y - 12, '#a8b4c0');
      sfx('block');
      this.hurt(Math.max(1, Math.round(m.dmg * (1 - red))), true);
    } else {
      this.pop(grade === 'early' ? 'TOO EARLY' : 'TOO LATE', p.x, p.y - 12, '#8a7a9a');
      this.hurt(m.dmg);
    }
  }

  damageFoe(dmg, col, p, label = null) {
    if (this.over) return;
    const f = this.foe;
    f.hp = Math.max(0, f.hp - dmg);
    this.foeA.flash = 1; this.foeA.knock = 1;
    const r = this.foeRect();
    this.pop((label ? label + ' ' : '') + dmg, r.x + r.w / 2 + rand.range(-10, 10), r.y + 4, col, 2);
    const px = p ? p.x : r.x + r.w / 2, py = p ? p.y : r.y + r.h / 2;
    this.burst(px, py, this.def.blood, 8, 70);
    if (f.hp <= 0) this.victory();
  }

  hurt(dmg, blocked = false) {
    if (this.over) return;
    const run = this.run, B = run.bless;
    run.hp = Math.max(0, run.hp - dmg);
    this.heroA.hurt = 1;
    const hr = this.heroRect();
    this.pop('-' + dmg, hr.x + hr.w / 2, hr.y - 4, '#ff5050', 2);
    if (!blocked) { this.combo = 0; shake(5); flash('#d02020', 0.2); sfx('hurt'); this.burst(hr.x + hr.w / 2, hr.y + hr.h / 2, '#e8e0c8', 8, 60); }
    else shake(2);
    if (run.hp <= 0) {
      if ((B.undying || 0) > (run.undyingUsed || 0)) {
        run.undyingUsed = (run.undyingUsed || 0) + 1;
        run.hp = Math.max(1, Math.round(run.maxHp * 0.3));
        this.pop('UNDYING!', hr.x + hr.w / 2, hr.y - 16, '#f0d050', 2);
        sfx('levelup');
      } else { this.defeat(); return; }
    }
    if (B.thorns) this.damageFoe(4 * B.thorns, '#7ac040', null, 'THORNS');
  }

  healHero(n, quiet = false) {
    const run = this.run;
    const before = run.hp;
    run.hp = Math.min(run.maxHp, run.hp + n);
    const got = run.hp - before;
    if (got > 0) {
      const hr = this.heroRect();
      this.pop('+' + got, hr.x + hr.w / 2 + 10, hr.y - 2, '#7ac040', quiet ? 1 : 2);
    }
  }

  victory() {
    if (this.over) return;
    this.over = true; this.phase = 'victory'; this.marks = [];
    this.explode(this.spr, this.foeRect(), false);
    this.foeGone = true;
    sfx('enemyDie');
    setTimeout(() => sfx('victory'), 350);
    const run = this.run, depth = run.depth;
    const xp = Math.round(this.def.xp * (1 + 0.15 * (depth - 1)));
    const gold = Math.round(rand.int(this.def.gold[0], this.def.gold[1]) * (1 + 0.1 * (depth - 1)) * goldMul(run));
    run.gold += gold; run.kills++;
    const levels = gainXp(run, xp);
    if (run.bless.necro) run.hp = Math.min(run.maxHp, run.hp + Math.round(run.maxHp * 0.12 * run.bless.necro));
    let drop = null, potion = false;
    if (this.def.boss) drop = makeWeapon(rand, depth + 1, null, rand.chance(0.35) ? 3 : 2);
    else if (rand.chance(0.1)) drop = makeWeapon(rand, depth);
    if (rand.chance(this.def.boss ? 1 : 0.15)) { potion = true; run.potions++; }
    this.rewards = { xp, gold, levels, drop, potion };
    this.after(900, () => { this.canLeave = true; });
  }

  leave() {
    this.explore.combatOver('win', this.ent, this.rewards);
    setScene(this.explore, 'diamond');
  }

  defeat() {
    if (this.over) return;
    this.over = true; this.phase = 'defeat'; this.marks = [];
    this.explode(SPR.hero, this.heroRect(), true);
    this.heroGone = true;
    sfx('death');
    this.after(2400, () => setScene(new GameOver(this.run, this.def.name), 'fade'));
  }

  flee() {
    if (this.def.boss || (this.phase !== 'player' && this.phase !== 'enemy' && this.phase !== 'pause')) { sfx('deny'); return; }
    if (rand.chance(0.55)) {
      this.over = true; this.phase = 'fled'; this.marks = [];
      this.ent.hp = this.foe.hp;
      this.pop('ESCAPED!', this.heroX, this.heroRect().y - 10, '#fffbea', 2);
      sfx('stairs');
      this.after(500, () => { this.explore.combatOver('flee', this.ent); setScene(this.explore, 'diamond'); });
    } else {
      this.pop('NO ESCAPE!', this.heroX, this.heroRect().y - 10, '#ff6050', 1);
      sfx('deny');
      this.marks = []; this.phase = 'pause'; this.timers = [];
      this.after(350, () => this.startEnemy());
    }
  }

  drinkPotion() {
    const run = this.run;
    if (this.over || run.potions <= 0 || run.hp >= run.maxHp) { sfx('deny'); return; }
    run.potions--;
    this.healHero(potionHeal(run));
    sfx('potion');
    const hr = this.heroRect();
    this.burst(hr.x + hr.w / 2, hr.y + hr.h / 2, '#d04040', 14, 50);
    if (this.phase === 'player') { this.marks = []; this.endPhase(); }
  }

  swap(i) {
    if (this.over || i === this.run.equipped || !this.run.weapons[i]) return;
    this.run.equipped = i;
    sfx('swap');
    this.heroA.swing = 0.5;
    if (this.phase === 'player') {
      if (this.phaseResolved === 0) { this.marks = []; this.phase = 'pause'; this.timers = []; this.after(250, () => this.startPlayer()); }
      else { this.marks = []; this.endPhase(); }
    }
  }

  // ---------- FX ----------
  pop(t, x, y, col, scale = 1) { this.pops.push({ text: t, x, y, col, scale, t: 0, life: 0.9 }); }
  burst(x, y, col, n, spd) {
    for (let i = 0; i < n; i++) {
      const a = rand.range(0, Math.PI * 2), v = rand.range(spd * 0.3, spd);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, col, t: 0, life: rand.range(0.3, 0.7), size: rand.chance(0.3) ? 2 : 1, grav: 160 });
    }
  }
  explode(spr, r, hero) {
    const z = this.zoom;
    const px = pixelsOf(spr);
    const step = px.length > 260 ? 2 : 1;
    for (let i = 0; i < px.length; i += step) {
      const p = px[i];
      const x = r.x + p.x * z, y = r.y + p.y * z;
      const cx = r.x + r.w / 2;
      this.parts.push({ x, y, vx: (x - cx) * rand.range(1, 3) + rand.range(-20, 20), vy: rand.range(-120, -20), col: p.col,
        t: 0, life: rand.range(0.8, 1.6), size: z, grav: 260, floor: hero ? this.heroY : this.foeY });
    }
  }

  update(dt) {
    this.clock += dt * 1000;
    if (this.timers.length) {
      const due = this.timers.filter(t => t.at <= this.clock);
      if (due.length) { this.timers = this.timers.filter(t => t.at > this.clock); due.forEach(t => t.fn()); }
    }
    const k = n => Math.max(0, n - dt * 5);
    this.heroA.lunge = k(this.heroA.lunge); this.heroA.hurt = k(this.heroA.hurt); this.heroA.swing = Math.max(0, this.heroA.swing - dt * 4);
    this.foeA.flash = Math.max(0, this.foeA.flash - dt * 7); this.foeA.knock = k(this.foeA.knock);
    this.foeA.lunge = Math.max(0, this.foeA.lunge - dt * 6); this.foeA.wind = Math.max(0, this.foeA.wind - dt * 2);
    this.foe.ghost = Math.max(this.foe.hp, this.foe.ghost - dt * this.foe.maxHp * 0.6);
    this.heroGhost = this.heroGhost > this.run.hp ? Math.max(this.run.hp, this.heroGhost - dt * this.run.maxHp * 0.5) : this.run.hp;

    if (this.phase === 'player' || this.phase === 'enemy') {
      for (const m of this.marks) {
        if (m.done) continue;
        if (m.kind === 'orb') { if (this.clock >= m.hitT) { m.done = true; this.hurt(m.dmg); } }
        else if (this.clock > m.hitT + m.good) this.autoResolve(m);
        if (this.over) break;
      }
      // A flawless turn (every strike landed) earns a sigil to trace for a bonus blast.
      if (!this.over && this.phase === 'player' && !this.sigilOffered && this.phaseStrikes > 0 && this.phaseHits === this.phaseStrikes &&
        this.marks.every(m => m.done)) {
        this.sigilOffered = true;
        this.addRune('sigil', rand.pick(Object.keys(RUNES)), this.clock, runeTime(this.run, SIGIL_TIME));
        this.pop('FLAWLESS!', G.W / 2, this.top + 14, '#f0d050');
        sfx('rune');
        if (this.hints) this.hint = 'DRAG ALONG THE SIGIL FOR A BONUS BLAST';
      }
      if (!this.over && (this.phase === 'player' || this.phase === 'enemy') && this.marks.length && this.marks.every(m => m.done)) this.endPhase();
    }
    for (const p of this.parts) {
      p.t += dt; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.floor && p.y > p.floor) { p.y = p.floor; p.vy *= -0.3; p.vx *= 0.6; }
    }
    this.parts = this.parts.filter(p => p.t < p.life);
    for (const p of this.pops) { p.t += dt; p.y -= dt * 22 * (1 - p.t / p.life); }
    this.pops = this.pops.filter(p => p.t < p.life);
    if (this.trail) { this.trail.t += dt; if (this.trail.t > 0.5) this.trail = null; }
    for (const s of this.slashes) s.t += dt;
    this.slashes = this.slashes.filter(s => s.t < 0.18);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.dur) this.banner = null; }
    if (this.promptT) { this.promptT.t += dt; if (this.promptT.t > 0.9) this.promptT = null; }
  }

  // ---------- Drawing ----------
  draw(g) {
    const W = G.W, z = this.zoom;
    g.drawImage(this.bg, 0, 0);
    const fr = this.foeRect(), hr = this.heroRect();
    ellipse(g, this.foeX, this.foeY, fr.w * 0.55 + 6, 5 + z, 'rgba(0,0,0,0.45)');
    ellipse(g, this.foeX, this.foeY, fr.w * 0.45, 3 + z, 'rgba(255,255,255,0.05)');
    ellipse(g, this.heroX, this.heroY, hr.w * 0.6 + 4, 5 + z, 'rgba(0,0,0,0.45)');

    if (!this.foeGone) {
      const t = this.clock / 1000;
      const fa = this.foeA;
      let ox = fa.knock * 7 + fa.wind * 6 - Math.sin(fa.lunge * Math.PI) * 26;
      let oy = Math.round(Math.sin(t * 2.4) * (this.def.fly ? 3 : 1)) + Math.sin(fa.lunge * Math.PI) * 10 - fa.wind * 2;
      if (this.def.boss && this.foe.hp < this.foe.maxHp / 2) ox += Math.round(Math.sin(t * 40) * 0.6);
      const x = Math.round(fr.x + ox), y = Math.round(fr.y + oy);
      if (this.def.fly) ellipse(g, this.foeX + ox, this.foeY, fr.w * 0.35, 3, 'rgba(0,0,0,0.25)');
      if (this.def.fade) g.globalAlpha = 0.85;
      g.drawImage(this.spr, x, y, fr.w, fr.h);
      g.globalAlpha = 1;
      if (fa.flash > 0.3) g.drawImage(silhouette(this.spr, '#ffffff'), x, y, fr.w, fr.h);
      if (this.foe.burn > 0 && Math.floor(t * 8) % 2) { g.globalAlpha = 0.3; g.drawImage(silhouette(this.spr, '#e8822c'), x, y, fr.w, fr.h); g.globalAlpha = 1; }
      if (this.foe.stun > 0) for (let i = 0; i < 3; i++) {
        const a = t * 4 + i * 2.1;
        g.drawImage(SPR.star, Math.round(x + fr.w / 2 + Math.cos(a) * 12 - 3), Math.round(y - 6 + Math.sin(a) * 3));
      }
      if (fa.wind > 0.5 && this.phase === 'enemy') text(g, '!', x + fr.w / 2, y - 14, '#ff5050', { scale: 3, align: 'center', outline: '#140c1c' });
    }

    if (!this.heroGone) {
      const ha = this.heroA;
      const ox = Math.round(Math.sin(ha.lunge * Math.PI) * 16 - ha.hurt * 6);
      const oy = Math.round(Math.sin(this.clock / 300) * 1);
      const x = Math.round(hr.x + ox), y = Math.round(hr.y + oy);
      // weapon behind arm
      const w = this.run.weapons[this.run.equipped];
      const ic = weaponIcon(w.base);
      const ws = Math.max(2, z - 1);
      const hx = x + hr.w * 0.86, hy = y + hr.h * 0.66;
      if (ha.swing > 0.05) {
        // Quarter-turn steps keep the pixel art crisp while swinging.
        const ang = Math.round(Math.sin(Math.min(1, ha.swing) * Math.PI) * 2) * (Math.PI / 4);
        g.save(); g.translate(Math.round(hx), Math.round(hy)); g.rotate(ang);
        g.drawImage(ic, -2 * ws, -(ic.height - 2) * ws, ic.width * ws, ic.height * ws);
        g.restore();
      } else {
        g.drawImage(ic, Math.round(hx - 2 * ws), Math.round(hy - (ic.height - 2) * ws), ic.width * ws, ic.height * ws);
      }
      g.drawImage(SPR.hero, x, y, hr.w, hr.h);
      if (ha.hurt > 0.4) g.drawImage(silhouette(SPR.hero, '#ff4040'), x, y, hr.w, hr.h);
      if (this.phase === 'enemy') {
        g.globalAlpha = 0.5;
        g.drawImage(SPR.shield, x - 4, y + hr.h * 0.45, SPR.shield.width * 2, SPR.shield.height * 2);
        g.globalAlpha = 1;
      }
    }

    for (const s of this.slashes) {
      const p = s.t / 0.18, len = s.big ? 30 : 22;
      const dx = Math.cos(s.a) * len, dy = Math.sin(s.a) * len;
      g.globalAlpha = 1 - p;
      line(g, s.x - dx * (1 - p), s.y - dy * (1 - p), s.x + dx, s.y + dy, s.big ? '#f0d050' : '#fffbea', s.big ? 3 : 2);
      g.globalAlpha = 1;
    }

    for (const m of this.marks) if (!m.done && m.kind !== 'rune') this.drawMark(g, m);
    for (const m of this.marks) if (!m.done && m.kind === 'rune' && this.clock >= m.spawnT) this.drawRuneMark(g, m);
    this.drawStroke(g);

    for (const p of this.parts) {
      g.globalAlpha = Math.min(1, (p.life - p.t) * 3);
      g.fillStyle = p.col; g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    g.globalAlpha = 1;
    for (const p of this.pops) {
      g.globalAlpha = Math.min(1, (p.life - p.t) * 4);
      const s = p.t < 0.08 ? p.scale + 1 : p.scale;
      text(g, p.text, p.x, p.y, p.col, { scale: s, align: 'center', outline: '#140c1c' });
    }
    g.globalAlpha = 1;

    this.drawHud(g);
  }

  drawMark(g, m) {
    const rem = (m.hitT - this.clock) / m.lead;
    if (rem > 1) return;
    const p = this.markPos(m);
    const x = Math.round(p.x), y = Math.round(p.y);
    if (m.kind === 'orb') {
      const pulse = Math.sin(this.clock / 60) > 0;
      disc(g, x, y, 9, 'rgba(122,192,64,0.25)');
      disc(g, x, y, 6, pulse ? '#7ac040' : '#9ae060');
      disc(g, x - 1, y - 1, 2, '#e0ffc0');
      ring(g, x, y, 7, '#140c1c');
      if (rand.chance(0.5)) this.parts.push({ x: x + rand.range(-3, 3), y: y + rand.range(-3, 3), vx: 0, vy: 0, col: '#7ac040', t: 0, life: 0.25, size: 1, grav: 0 });
      return;
    }
    const hidden = this.def.fade && m.kind !== 'strike' && rem > 0.45;
    const cols = {
      strike: ['#fffbea', m.crit ? '#ff6050' : '#f0d050'],
      guard: ['#70d0e0', '#a0f0ff'],
      feint: ['#c070f0', '#c070f0'],
    }[m.kind];
    const appear = clamp((1 - rem) * 8, 0, 1);
    if (hidden) {
      g.globalAlpha = 0.25;
      ring(g, x, y, R_IN, cols[0]);
      g.globalAlpha = 1;
      return;
    }
    const r0 = Math.max(2, Math.round(R_IN * appear));
    disc(g, x, y, r0 + 1, 'rgba(10,6,20,0.65)');
    const inWin = Math.abs(this.clock - m.hitT) <= m.perfect;
    ring(g, x, y, r0, inWin ? '#ffffff' : cols[0], inWin ? 2 : 1);
    const ic = m.kind === 'strike' ? (m.crit ? SPR.star : SPR.swordIcon) : m.kind === 'guard' ? SPR.shield : SPR.skullIcon;
    if (appear >= 1) g.drawImage(ic, Math.round(x - ic.width / 2), Math.round(y - ic.height / 2));
    if (rem > -0.02) {
      const rr = R_IN + Math.round(24 * Math.max(0, rem));
      const close = rem < 0.2;
      g.globalAlpha = m.kind === 'feint' ? 0.6 : 1;
      ring(g, x, y, rr, close ? cols[1] : cols[0], close ? 2 : 1);
      g.globalAlpha = 1;
    }
  }

  drawRuneMark(g, m) {
    const curse = m.owner === 'curse';
    const rem = clamp((m.hitT - this.clock) / m.lead, 0, 1);
    const appear = clamp((this.clock - m.spawnT) / 150, 0, 1);
    const R = Math.round(m.size * 0.62 * (0.6 + 0.4 * appear));
    const col = curse ? '#ff5080' : '#f0d050', glow = curse ? '#ff90d0' : '#fff0a0';
    g.globalAlpha = 0.72; disc(g, m.x, m.y, R, '#0a0614'); g.globalAlpha = 1;
    ring(g, m.x, m.y, R, curse ? '#502040' : '#504020');
    // Countdown: a ring of dots that empties as the rune nears completion.
    const dots = 40, lit = Math.ceil(dots * rem);
    for (let i = 0; i < dots; i++) {
      const a = -Math.PI / 2 + (i / dots) * Math.PI * 2;
      g.fillStyle = i < lit ? (rem < 0.3 && Math.floor(this.clock / 90) % 2 ? '#ffffff' : col) : '#2a1d33';
      g.fillRect(Math.round(m.x + Math.cos(a) * (R + 3)) - 1, Math.round(m.y + Math.sin(a) * (R + 3)) - 1, 2, 2);
    }
    if (appear < 1) return;
    const pulse = Math.floor(this.clock / 150) % 2 === 0;
    drawRune(g, m.rune, m.x, m.y, m.size, pulse ? col : glow, { thick: 3, shadow: '#140c1c', start: '#ffffff', pulse });
    text(g, curse ? 'TRACE TO DISPEL!' : 'TRACE THE SIGIL!', m.x, m.y + R + 8, glow, { align: 'center', outline: '#140c1c' });
  }

  drawStroke(g) {
    const s = this.stroke ? { pts: this.stroke, t: 0, ok: null } : this.trail;
    if (!s || s.pts.length < 2) return;
    const col = s.ok === null ? '#ffffff' : s.ok ? '#a0f0ff' : '#8a7a9a';
    g.globalAlpha = s.ok === null ? 1 : Math.max(0, 1 - s.t * 2);
    for (let i = 1; i < s.pts.length; i++) line(g, s.pts[i - 1][0], s.pts[i - 1][1], s.pts[i][0], s.pts[i][1], col, 2);
    g.globalAlpha = 1;
  }

  drawHud(g) {
    const W = G.W, run = this.run, f = this.foe;
    const ty = G.safeTop + 4;
    g.fillStyle = 'rgba(7,4,12,0.6)'; g.fillRect(0, 0, W, ty + 18);
    text(g, this.def.name, 6, ty, this.def.boss ? '#f0d050' : '#e8e0c8', { outline: '#140c1c' });
    const status = [];
    if (f.armor) status.push('ARM ' + f.armor);
    if (f.burn) status.push('BURN ' + f.burn);
    if (f.bleed) status.push('BLEED ' + f.bleed);
    if (f.stun) status.push('STUN');
    text(g, status.join('  '), W - 6, ty, '#a898b0', { align: 'right', outline: '#140c1c' });
    ui.bar(g, 6, ty + 8, W - 12, 5, f.hp / f.maxHp, this.def.boss ? '#c070f0' : '#d04040', '#2a1420', f.ghost / f.maxHp);
    text(g, `${f.hp}/${f.maxHp}`, W / 2, ty + 8, '#fffbea', { align: 'center', outline: '#140c1c' });

    const by = this.barY - 13;
    g.drawImage(SPR.heart, 4, by - 1);
    const bw = Math.floor(W * 0.38);
    ui.bar(g, 15, by, bw, 6, run.hp / run.maxHp, run.hp < run.maxHp * 0.3 ? '#ff4040' : '#c83c3c', '#3a1420', this.heroGhost / run.maxHp);
    text(g, `${run.hp}/${run.maxHp}`, 19 + bw, by + 1, '#e8e0c8', { outline: '#140c1c' });
    if (this.combo >= 2) {
      const pulse = this.combo >= 10 ? '#f0d050' : '#fffbea';
      text(g, `${this.combo} COMBO`, W - 6, by - 1, pulse, { align: 'right', scale: this.combo >= 10 ? 2 : 1, outline: '#140c1c' });
    }

    if (this.banner) {
      const b = this.banner;
      const a = Math.min(1, b.t * 5, (b.dur - b.t) * 4);
      g.globalAlpha = Math.max(0, a);
      const cy = Math.round(this.top + this.arenaH * 0.2);
      g.fillStyle = 'rgba(7,4,12,0.75)'; g.fillRect(0, cy - 6, W, 30);
      text(g, b.sub, W / 2, cy - 2, this.def.boss ? '#d04040' : '#a898b0', { align: 'center' });
      text(g, b.text, W / 2, cy + 6, this.def.boss ? '#f0d050' : '#fffbea', { align: 'center', scale: 2, outline: '#140c1c' });
      g.globalAlpha = 1;
    } else if (this.promptT) {
      const p = this.promptT;
      g.globalAlpha = Math.max(0, Math.min(1, (0.9 - p.t) * 3));
      text(g, p.text, W / 2, this.top + 2, p.col, { align: 'center', scale: 2, outline: '#140c1c' });
      g.globalAlpha = 1;
    }
    if (this.hint && this.hints && !this.over) {
      text(g, this.hint, W / 2, this.barY - 24, '#c8b8d8', { align: 'center', outline: '#140c1c' });
    }

    ui.actionBar(g, run, {
      onSlot: i => this.swap(i),
      onPotion: () => this.drinkPotion(),
      potionDisabled: this.over,
      extras: [{ label: 'RUN', icon: null, fn: () => this.flee(), disabled: this.def.boss || this.over, color: '#e8e0c8' }],
    });

    if (this.phase === 'victory' && this.rewards) this.drawVictory(g);
  }

  drawVictory(g) {
    const W = G.W, r = this.rewards;
    const lines = [[`+${r.xp} XP`, '#5ab0f0'], [`+${r.gold} GOLD`, '#f0d050']];
    if (r.levels) lines.push(['LEVEL UP!', '#7ac040']);
    if (r.potion) lines.push(['+1 LIFE BOTTLE', '#d04040']);
    if (r.drop) lines.push(['DROPPED: ' + weaponName(r.drop), RARITY[r.drop.rarity].color]);
    const w = Math.min(W - 20, 200), h = 34 + lines.length * 9 + 12;
    const x = Math.round((W - w) / 2), y = Math.round(this.top + this.arenaH * 0.22);
    ui.panel(g, x, y, w, h, '#1c1228', '#f0d050');
    text(g, 'VICTORY!', W / 2, y + 7, '#f0d050', { align: 'center', scale: 3, outline: '#140c1c' });
    lines.forEach(([t, c], i) => text(g, t, W / 2, y + 30 + i * 9, c, { align: 'center' }));
    if (this.canLeave && Math.floor(this.clock / 400) % 2 === 0) text(g, 'TAP TO CONTINUE', W / 2, y + h - 9, '#a898b0', { align: 'center' });
    if (this.canLeave) { ui.modalBegin(); ui.hit(0, 0, W, G.H, () => this.leave()); }
  }

  onKey(k) {
    if (k === '1' || k === '2' || k === '3') this.swap(+k - 1);
    if (k === 'q') this.drinkPotion();
  }
  onHide() { /* timing is clock based; nothing to pause */ }
}
