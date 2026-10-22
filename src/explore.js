// Isometric dungeon exploration: tap to move (or autoexplore), turn-based enemies, loot, shops, stairs.
import { G, setScene, shake, flash } from './engine.js';
import { text } from './font.js';
import { SPR, weaponIcon } from './sprites.js';
import { flipH, dimmed, ellipse, makeCanvas, disc, ring, line } from './gfx.js';
import { TW, TH, WH, getTiles } from './tiles.js';
import { generate, MW, MH, FLOOR } from './dungeon.js';
import {
  ENEMIES, themeFor, isBossFloor, FINAL_DEPTH, makeWeapon, weaponName, RARITY,
  potionHeal, goldMul, pickBlessings, applyBlessing, scaleEnemy, addPotions, potionRoom,
} from './data.js';
import { sfx, playMusic, settings, saveSettings } from './audio.js';
import { rand } from './rng.js';
import { saveGame, clearSave, recordRunEnd } from './state.js';
import * as ui from './ui.js';
import { Combat } from './combat.js';
import { Title, howToDialog, openWiki } from './title.js';

const STEP = 0.12;
const HW = TW / 2, HH = TH / 2;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const SIGHT = 7;

const flipCache = new Map();
const flipped = c => { let f = flipCache.get(c); if (!f) { f = flipH(c); flipCache.set(c, f); } return f; };

export class Explore {
  constructor(run, saved = null) {
    this.run = run;
    this.modal = null; this.queue = [];
    this.loadFloor(saved);
  }

  // ---------- Floor setup / persistence ----------
  loadFloor(saved) {
    const run = this.run;
    const seed = saved ? saved.seed : (run.seed ^ Math.imul(run.depth, 0x9e3779b1)) >>> 0;
    this.floorSeed = seed;
    const m = generate(run.depth, seed);
    this.map = m; this.theme = m.theme; this.tiles = getTiles(m.theme);
    this.ents = saved ? saved.ents : m.ents;
    this.nextId = saved ? saved.nextId : m.nextId;
    this.explored = new Uint8Array(MW * MH);
    if (saved && saved.explored) for (let i = 0; i < saved.explored.length; i++) if (saved.explored[i] === '1') this.explored[i] = 1;
    this.visible = new Uint8Array(MW * MH);
    const [px, py] = saved ? [saved.px, saved.py] : m.start;
    this.player = { x: px, y: py, fx: px, fy: py, t: 1, path: [], face: 1 };
    for (const e of this.ents) { e.rx = e.x; e.ry = e.y; }
    this.fx = []; this.msgs = []; this.motes = [];
    this.turn = 0; this.target = null; this.camX = null; this.auto = false;
    this.computeFov();
    this.banner = { t: 0, text: `${m.theme.name} ${run.depth}`, sub: m.boss ? 'A great evil stirs...' : run.depth === 1 ? 'Tap the ground to walk' : '' };
    if (!saved) this.save();
  }

  serialize() {
    let ex = '';
    for (let i = 0; i < this.explored.length; i++) ex += this.explored[i] ? '1' : '0';
    const ents = this.ents.map(e => { const c = { ...e }; delete c.rx; delete c.ry; delete c.alert; return c; });
    return { v: 1, run: this.run, floor: { seed: this.floorSeed, ents, nextId: this.nextId, explored: ex, px: this.player.x, py: this.player.y } };
  }
  save() { if (this.run.hp > 0) saveGame(this.serialize()); }

  enter() {
    this.inCombat = false;
    playMusic('explore');
    this.resize();
    if (this.run.levelUps > 0) {
      const n = this.run.levelUps;
      this.run.levelUps = 0;
      for (let i = 0; i < n; i++) this.pushModal(this.blessingDialog('LEVEL UP!', 'Choose a blessing'));
    }
  }
  exit() { this.save(); }
  resize() { this.vignette = null; }
  onHide() { this.save(); }

  // ---------- Map helpers ----------
  idx(x, y) { return y * MW + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < MW && y < MH; }
  floor(x, y) { return this.inb(x, y) && this.map.tiles[this.idx(x, y)] === FLOOR; }
  passable(x, y) { return this.floor(x, y) && !this.map.solid[this.idx(x, y)]; }
  entAt(x, y, pred = () => true) { return this.ents.find(e => e.x === x && e.y === y && pred(e)); }
  blocking(e) { return ['enemy', 'chest', 'merchant', 'fountain', 'altar'].includes(e.kind); }
  canStep(x0, y0, x1, y1) {
    if (!this.passable(x1, y1)) return false;
    if (x0 !== x1 && y0 !== y1) return this.passable(x1, y0) && this.passable(x0, y1);
    return true;
  }

  computeFov() {
    const p = this.player;
    this.visible.fill(0);
    const R = SIGHT;
    const mark = (x, y) => { if (this.inb(x, y)) { this.visible[this.idx(x, y)] = 1; this.explored[this.idx(x, y)] = 1; } };
    mark(p.x, p.y);
    for (let i = -R; i <= R; i++) for (const [tx, ty] of [[p.x + i, p.y - R], [p.x + i, p.y + R], [p.x - R, p.y + i], [p.x + R, p.y + i]]) {
      let x0 = p.x, y0 = p.y;
      const dx = Math.abs(tx - x0), dy = -Math.abs(ty - y0), sx = x0 < tx ? 1 : -1, sy = y0 < ty ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        if ((x0 - p.x) ** 2 + (y0 - p.y) ** 2 > R * R + 1) break;
        mark(x0, y0);
        if (!this.floor(x0, y0)) break;
        if (x0 === tx && y0 === ty) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
  }

  // A* over explored tiles; goal may be a blocking entity tile (we bump into it).
  findPath(gx, gy) {
    const p = this.player;
    const start = this.idx(p.x, p.y), goal = this.idx(gx, gy);
    if (start === goal) return [];
    const open = [start], came = new Map(), gs = new Map([[start, 0]]);
    const h = i => { const x = i % MW, y = (i / MW) | 0; return Math.max(Math.abs(x - gx), Math.abs(y - gy)); };
    const fs = new Map([[start, h(start)]]);
    const closed = new Set();
    let iter = 0;
    while (open.length && iter++ < 4000) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (fs.get(open[i]) < fs.get(open[bi])) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (cur === goal) {
        const path = [];
        let c = cur;
        while (c !== start) { path.unshift([c % MW, (c / MW) | 0]); c = came.get(c); }
        return path;
      }
      closed.add(cur);
      const cx = cur % MW, cy = (cur / MW) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.inb(nx, ny)) continue;
        const ni = this.idx(nx, ny);
        if (closed.has(ni) || !this.explored[ni]) continue;
        if (!this.canStep(cx, cy, nx, ny)) continue;
        if (ni !== goal && this.entAt(nx, ny, e => this.blocking(e) && e.kind !== 'enemy')) continue;
        const ng = gs.get(cur) + (dx && dy ? 1.01 : 1);
        if (ng < (gs.get(ni) ?? 1e9)) {
          came.set(ni, cur); gs.set(ni, ng); fs.set(ni, ng + h(ni));
          if (!open.includes(ni)) open.push(ni);
        }
      }
    }
    return null;
  }

  // ---------- Input ----------
  screenOf(x, y) { return [Math.round((x - y) * HW + this.ox), Math.round((x + y) * HH + this.oy)]; }
  tileAt(sx, sy) {
    const u = (sx - this.ox) / HW, v = (sy - this.oy) / HH;
    return [Math.round((u + v) / 2), Math.round((v - u) / 2)];
  }

  onTap(sx, sy) {
    if (this.modal || this.inCombat) return;
    if (this.auto) this.stopAuto();
    // Entities first (tall sprites stick up above their tile).
    let target = null;
    const vis = this.ents.filter(e => this.isShown(e) && e.kind !== 'stairs').sort((a, b) => (b.x + b.y) - (a.x + a.y));
    for (const e of vis) {
      const s = this.entSprite(e);
      if (!s) continue;
      const [cx, cy] = this.screenOf(e.rx, e.ry);
      if (sx >= cx - s.width / 2 - 3 && sx <= cx + s.width / 2 + 3 && sy >= cy - s.height - 2 && sy <= cy + 4) { target = e; break; }
    }
    let tx, ty;
    if (target) { tx = target.x; ty = target.y; } else [tx, ty] = this.tileAt(sx, sy);
    if (!this.inb(tx, ty)) return;
    const p = this.player;
    if (tx === p.x && ty === p.y) {
      const here = this.entAt(tx, ty, e => !this.blocking(e));
      if (here) this.onStand(here, true);
      return;
    }
    if (!this.explored[this.idx(tx, ty)] || !this.floor(tx, ty)) { this.tapFx(tx, ty, '#d04040'); return; }
    if (this.map.solid[this.idx(tx, ty)]) { this.tapFx(tx, ty, '#d04040'); return; }
    const blocker = this.entAt(tx, ty, e => this.blocking(e));
    if (blocker && Math.max(Math.abs(tx - p.x), Math.abs(ty - p.y)) === 1 && this.canStep(p.x, p.y, tx, ty)) {
      p.path = [[tx, ty]];
    } else {
      const path = this.findPath(tx, ty);
      if (!path) { this.tapFx(tx, ty, '#d04040'); sfx('deny'); return; }
      p.path = path;
    }
    this.target = [tx, ty];
    this.tapFx(tx, ty, '#fffbea');
    sfx('tap');
  }

  tapFx(x, y, col) { this.fx.push({ kind: 'tap', x, y, col, t: 0 }); }

  onKey(k) {
    if (this.modal) return;
    const p = this.player;
    const d = { ArrowUp: [-1, -1], ArrowDown: [1, 1], ArrowLeft: [-1, 1], ArrowRight: [1, -1], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }[k];
    if (d && this.auto) this.stopAuto();
    if (d && p.t >= 1 && !p.path.length) { p.path = [[p.x + d[0], p.y + d[1]]]; }
    if (k === 'x') this.toggleAuto();
    if (k === 'Escape') this.openMenu();
  }

  // ---------- Turn loop ----------
  update(dt) {
    const p = this.player;
    if (this.banner) { this.banner.t += dt; if (this.banner.t > 3) this.banner = null; }
    if (p.t < 1) {
      p.t = Math.min(1, p.t + dt / STEP);
      if (p.t >= 1) this.arrive();
    } else if (!this.modal && !this.inCombat) {
      if (this.auto) this.autoStep();
      if (p.path.length) this.tryStep();
    }
    const k = Math.min(1, dt * 14);
    for (const e of this.ents) { e.rx += (e.x - e.rx) * k; e.ry += (e.y - e.ry) * k; if (e.alert) e.alert = Math.max(0, e.alert - dt); }
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter(f => f.t < (f.life || 0.5));
    for (const m of this.msgs) m.t += dt;
    this.msgs = this.msgs.filter(m => m.t < 4);
    if (this.motes.length < 14 && rand.chance(dt * 6)) {
      this.motes.push({ x: rand.range(0, G.W), y: rand.range(0, G.H), vx: rand.range(-4, 4), vy: rand.range(-6, -1), t: 0, life: rand.range(3, 6) });
    }
    for (const m of this.motes) { m.t += dt; m.x += m.vx * dt; m.y += m.vy * dt; }
    this.motes = this.motes.filter(m => m.t < m.life);
  }

  tryStep() {
    const p = this.player;
    const [nx, ny] = p.path[0];
    const blocker = this.entAt(nx, ny, e => this.blocking(e));
    if (blocker) {
      p.path = []; this.target = null;
      if (blocker.kind === 'enemy') this.engage(blocker); else this.interact(blocker);
      return;
    }
    if (!this.canStep(p.x, p.y, nx, ny)) { p.path = []; this.target = null; return; }
    p.path.shift();
    p.fx = p.x; p.fy = p.y; p.x = nx; p.y = ny; p.t = 0;
    const sdx = (nx - p.fx) - (ny - p.fy);
    if (sdx) p.face = sdx > 0 ? 1 : -1;
    sfx('step');
  }

  arrive() {
    const p = this.player, run = this.run;
    run.steps++; this.turn++;
    this.computeFov();
    if (this.auto) {
      const seen = this.ents.find(e => e.kind === 'enemy' && this.visible[this.idx(e.x, e.y)] && !this.autoSeen.has(e.id));
      if (seen) { this.stopAuto(`${ENEMIES[seen.type].name} spotted!`, '#ff6050'); seen.alert = Math.max(seen.alert || 0, 0.6); }
    }
    const last = p.path.length === 0;
    if (last) this.target = null;
    for (const e of this.ents.filter(e => e.x === p.x && e.y === p.y && !this.blocking(e))) this.onStand(e, last);
    this.enemyTurn();
    if (run.steps % 12 === 0) this.save();
  }

  onStand(e, isDest) {
    const run = this.run;
    if (e.kind === 'gold') {
      const amt = Math.round(e.amount * goldMul(run));
      run.gold += amt; this.remove(e); sfx('coin');
      this.floatText('+' + amt, e.x, e.y, '#f0d050');
    } else if (e.kind === 'potion') {
      if (!potionRoom(run)) { if (isDest) this.say('Your bottle belt is full.', '#a898b0'); return; }
      addPotions(run); this.remove(e); sfx('pickup');
      this.say('Found a Life Bottle!', '#d04040');
      this.floatText('+1', e.x, e.y, '#d04040');
    } else if (e.kind === 'weapon') {
      if (isDest) { this.player.path = []; this.pushModal(this.weaponDialog(e.weapon, e)); }
      else this.say('Something glints here...', '#a898b0');
    } else if (e.kind === 'stairs') {
      if (isDest && (!this.auto || this.autoGoal === 'stairs')) { this.stopAuto(); this.player.path = []; this.pushModal(this.descendDialog()); }
    }
  }

  enemyTurn() {
    const p = this.player;
    for (const e of this.ents) {
      if (e.kind !== 'enemy') continue;
      if (e.stun > 0) { e.stun--; continue; }
      const def = ENEMIES[e.type];
      const d = Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y));
      if (!e.awake) {
        if (this.visible[this.idx(e.x, e.y)] && d <= 6) {
          e.awake = true; e.alert = 1; sfx('alert');
        } else {
          if (!e.boss && rand.chance(0.2)) this.moveEnemy(e, rand.pick(DIRS));
          continue;
        }
      }
      if (e.boss || d <= 1) continue;
      if (def.slow && this.turn % 2) continue;
      const moves = def.fast ? 2 : 1;
      for (let i = 0; i < moves; i++) {
        const dd = Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y));
        if (dd <= 1) break;
        const opts = DIRS.map(([dx, dy]) => [dx, dy, Math.max(Math.abs(e.x + dx - p.x), Math.abs(e.y + dy - p.y)) + 0.01 * Math.hypot(e.x + dx - p.x, e.y + dy - p.y)])
          .sort((a, b) => a[2] - b[2]);
        for (const [dx, dy, sc] of opts) {
          if (sc >= dd + 0.5) break;
          if (this.moveEnemy(e, [dx, dy])) break;
        }
      }
    }
    const adj = this.ents.find(e => e.kind === 'enemy' && e.awake && !e.stun &&
      Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y)) <= 1 && this.canStep(e.x, e.y, p.x, p.y));
    if (adj) { p.path = []; this.target = null; this.engage(adj); }
  }

  moveEnemy(e, [dx, dy]) {
    const nx = e.x + dx, ny = e.y + dy, p = this.player;
    if (!this.canStep(e.x, e.y, nx, ny)) return false;
    if (nx === p.x && ny === p.y) return false;
    if (this.entAt(nx, ny, o => this.blocking(o) || o.kind === 'stairs')) return false;
    e.x = nx; e.y = ny;
    return true;
  }

  engage(e) {
    if (this.inCombat || this.run.hp <= 0) return;
    this.inCombat = true;
    this.auto = false;
    this.player.path = [];
    sfx('engage');
    this.save();
    setScene(new Combat(this.run, e, this), 'diamond');
  }

  combatOver(result, e, rewards) {
    const run = this.run;
    if (result === 'win') {
      this.remove(e);
      if (e.boss) {
        this.ents.push({ id: this.nextId++, kind: 'stairs', x: e.x, y: e.y, rx: e.x, ry: e.y });
        if (run.depth === FINAL_DEPTH && !run.won) {
          run.won = true;
          this.pushModal({
            title: 'VICTORY!', titleColor: '#f0d050', border: '#f0d050',
            body: ['Lich Morthos crumbles to dust. The kingdom is saved, and Sir Rattlebone has earned his rest.',
              { t: 'Or... the stairs lead deeper still. Endless dark awaits.', c: '#a898b0' }],
            buttons: [
              { label: 'RETIRE', fn: () => { this.closeModal(); this.endRun(true); } },
              { label: 'GO DEEPER', primary: true, fn: () => this.closeModal() },
            ],
          });
        } else this.say('The way down is open!', '#f0d050');
      }
      if (rewards && rewards.drop) {
        const spot = this.freeNear(e.x, e.y);
        this.ents.push({ id: this.nextId++, kind: 'weapon', weapon: rewards.drop, x: spot[0], y: spot[1], rx: spot[0], ry: spot[1] });
      }
      this.floatText('+' + rewards.gold, e.x, e.y, '#f0d050');
    } else if (result === 'flee') {
      e.stun = 3; e.awake = true;
      this.say('You slip away!', '#a898b0');
    }
    this.save();
  }

  freeNear(x, y) {
    if (!this.entAt(x, y)) return [x, y];
    for (let r = 1; r < 4; r++) for (const [dx, dy] of DIRS) {
      const nx = x + dx * r, ny = y + dy * r;
      if (this.passable(nx, ny) && !this.entAt(nx, ny) && !(nx === this.player.x && ny === this.player.y)) return [nx, ny];
    }
    return [x, y];
  }

  remove(e) { this.ents = this.ents.filter(o => o !== e); }

  interact(e) {
    const run = this.run;
    if (e.kind === 'chest') {
      if (e.opened) { this.say('Empty.', '#8a7a9a'); return; }
      if (e.mimic) {
        const st = scaleEnemy('mimic', run.depth);
        Object.assign(e, { kind: 'enemy', type: 'mimic', ...st, awake: true, stun: 0, boss: false, alert: 1 });
        delete e.mimic;
        this.say('The chest has teeth!', '#d04040');
        shake(4); sfx('alert');
        this.engage(e);
        return;
      }
      e.opened = true; sfx('chest');
      const r = rand.next();
      if (r < 0.4) {
        const amt = Math.round((rand.int(12, 25) + run.depth * 4) * goldMul(run));
        run.gold += amt; this.floatText('+' + amt, e.x, e.y, '#f0d050'); this.say(`Found ${amt} gold.`, '#f0d050');
      } else if (r < 0.65) {
        if (addPotions(run)) { this.floatText('+1', e.x, e.y, '#d04040'); this.say('Found a Life Bottle!', '#d04040'); }
        else this.say('A Life Bottle, but your belt is full.', '#a898b0');
      } else {
        const w = makeWeapon(rand, run.depth, null, rand.chance(0.5) ? Math.max(1, rand.int(1, 2)) : null);
        this.pushModal(this.weaponDialog(w, null));
      }
      this.save();
    } else if (e.kind === 'fountain') {
      if (e.used) { this.say('The fountain is dry.', '#8a7a9a'); return; }
      e.used = true;
      const heal = Math.round(run.maxHp * 0.5);
      run.hp = Math.min(run.maxHp, run.hp + heal);
      sfx('heal'); this.floatText('+' + heal, e.x, e.y, '#7ac040');
      this.say('The waters mend your bones.', '#70d0e0');
      this.save();
    } else if (e.kind === 'merchant') {
      if (!e.stock) e.stock = this.makeStock();
      this.pushModal(this.shopDialog(e));
    } else if (e.kind === 'altar') {
      if (e.used) { this.say('The altar is silent.', '#8a7a9a'); return; }
      const cost = Math.max(5, Math.round(run.maxHp * 0.15));
      this.pushModal({
        title: 'BONE ALTAR', border: '#d04040',
        body: [`Sacrifice ${cost} max HP for a blessing?`, { t: 'The bones whisper of power...', c: '#a898b0' }],
        buttons: [
          { label: 'LEAVE', fn: () => this.closeModal() },
          { label: 'OFFER', primary: true, fn: () => {
            if (run.maxHp - cost < 10) { sfx('deny'); return; }
            e.used = true; run.maxHp -= cost; run.hp = Math.min(run.hp, run.maxHp);
            sfx('hurt'); flash('#d04040', 0.3);
            this.closeModal();
            this.pushModal(this.blessingDialog('BLESSED', 'The altar grants a gift'));
          } },
        ],
      });
    }
  }

  // ---------- Autoexplore ----------
  // Walks to the nearest unexplored edge (grabbing gold, bottles and chests on the way), stops when a
  // new monster comes into view, and heads for the stairs once the floor is done. Fights and the
  // descend prompt are still up to the player.
  toggleAuto() {
    if (this.auto) { this.stopAuto('Autoexplore off.', '#a898b0'); return; }
    if (this.modal || this.inCombat) return;
    this.auto = true; this.autoGoal = null;
    this.autoSeen = new Set(this.ents.filter(e => e.kind === 'enemy' && this.visible[this.idx(e.x, e.y)]).map(e => e.id));
    sfx('tap');
    if (this.player.t >= 1) this.autoStep();
  }

  stopAuto(msg, col) {
    if (!this.auto) return;
    this.auto = false; this.autoGoal = null;
    this.player.path = []; this.target = null;
    if (msg) this.say(msg, col);
  }

  autoStep() {
    const p = this.player;
    // Finish the current route before picking a new goal: replanning every step lets a monster
    // shuffling in a doorway flip the plan back and forth forever.
    if (p.path.length) return;
    const found = this.autoPath();
    if (!found) {
      const stairs = this.ents.find(e => e.kind === 'stairs' && this.explored[this.idx(e.x, e.y)]);
      if (stairs && stairs.x === p.x && stairs.y === p.y) { this.stopAuto(); this.pushModal(this.descendDialog()); return; }
      const path = stairs && this.findPath(stairs.x, stairs.y);
      if (!path) {
        this.stopAuto(this.ents.some(e => e.kind === 'enemy' && this.explored[this.idx(e.x, e.y)]) ? 'Something blocks the way.' : 'Nothing left to explore.', '#a898b0');
        sfx('deny');
        return;
      }
      if (this.autoGoal !== 'stairs') this.say('Floor explored. Heading to the stairs.', '#f0d050');
      this.autoGoal = 'stairs';
      p.path = path; this.target = [stairs.x, stairs.y];
      return;
    }
    this.autoGoal = found.kind;
    p.path = found.path; this.target = found.path[found.path.length - 1];
  }

  // BFS over known tiles to the closest frontier tile or pickup. Returns {path, kind} or null.
  autoPath() {
    const p = this.player, run = this.run;
    const goals = new Map();
    for (const e of this.ents) {
      if (!this.explored[this.idx(e.x, e.y)]) continue;
      const take = e.kind === 'gold' || (e.kind === 'potion' && potionRoom(run)) || (e.kind === 'chest' && !e.opened) ||
        (e.kind === 'fountain' && !e.used && run.hp < run.maxHp * 0.6);
      if (take) goals.set(this.idx(e.x, e.y), e.kind);
    }
    const frontier = i => {
      const x = i % MW, y = (i / MW) | 0;
      for (const [dx, dy] of DIRS) if (this.inb(x + dx, y + dy) && !this.explored[this.idx(x + dx, y + dy)]) return true;
      return false;
    };
    const start = this.idx(p.x, p.y);
    const came = new Map([[start, -1]]);
    const queue = [start];
    for (let qi = 0; qi < queue.length; qi++) {
      const cur = queue[qi];
      if (cur !== start && (goals.has(cur) || frontier(cur))) {
        const path = [];
        for (let c = cur; c !== start; c = came.get(c)) path.unshift([c % MW, (c / MW) | 0]);
        return { path, kind: goals.get(cur) || 'explore' };
      }
      const cx = cur % MW, cy = (cur / MW) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.inb(nx, ny)) continue;
        const ni = this.idx(nx, ny);
        if (came.has(ni) || !this.explored[ni] || !this.canStep(cx, cy, nx, ny)) continue;
        const blocker = this.entAt(nx, ny, e => this.blocking(e));
        if (blocker && !goals.has(ni)) continue;
        came.set(ni, cur);
        // Goals that block (chests, fountains) are bumped into, never walked through.
        if (blocker) { const path = []; for (let c = ni; c !== start; c = came.get(c)) path.unshift([c % MW, (c / MW) | 0]); return { path, kind: goals.get(ni) }; }
        queue.push(ni);
      }
    }
    return null;
  }

  // ---------- Dialogs ----------
  pushModal(m) { if (this.modal) this.queue.push(m); else this.modal = m; }
  closeModal() { this.modal = this.queue.shift() || null; this.save(); }

  blessingDialog(title, sub) {
    const choices = pickBlessings(rand, this.run, 3);
    return {
      title, sub,
      options: choices.map(b => ({
        title: b.name + ((this.run.bless[b.id] || 0) ? ` (${this.run.bless[b.id] + 1})` : ''), desc: b.desc, color: '#f0d050', icon: SPR.star,
        fn: () => { applyBlessing(this.run, b.id); sfx('levelup'); this.closeModal(); },
      })),
    };
  }

  weaponDialog(w, ent) {
    const run = this.run;
    const take = () => { sfx('pickup'); if (ent) this.remove(ent); this.closeModal(); };
    if (run.weapons.length < 3) {
      return {
        title: 'NEW WEAPON', weapon: w,
        buttons: [
          { label: 'LEAVE', fn: () => { if (!ent) this.dropWeapon(w); this.closeModal(); } },
          { label: 'TAKE', primary: true, fn: () => { run.weapons.push(w); take(); } },
        ],
      };
    }
    return {
      title: 'NEW WEAPON', weapon: w, sub: 'Bag full - swap one out (it is left here)',
      options: run.weapons.map((cw, i) => ({
        title: weaponName(cw), desc: ui.statLine(cw, run), icon: weaponIcon(cw.base), color: RARITY[cw.rarity].color,
        fn: () => {
          run.weapons[i] = w;
          if (ent) this.remove(ent);
          this.dropWeapon(cw);
          sfx('pickup'); this.closeModal();
        },
      })),
      buttons: [{ label: 'LEAVE IT', fn: () => { if (!ent) this.dropWeapon(w); this.closeModal(); } }],
    };
  }

  dropWeapon(w) {
    const p = this.player;
    this.ents.push({ id: this.nextId++, kind: 'weapon', weapon: w, x: p.x, y: p.y, rx: p.x, ry: p.y });
  }

  descendDialog() {
    const next = this.run.depth + 1;
    const th = themeFor(next);
    return {
      title: 'DESCEND?',
      sub: `Floor ${next}: ${th.name}${isBossFloor(next) ? ' - BOSS' : ''}`,
      body: this.ents.some(e => e.kind === 'chest' && !e.opened && this.explored[this.idx(e.x, e.y)]) ? [{ t: 'Unopened chests remain.', c: '#a898b0' }] : [],
      buttons: [
        { label: 'STAY', fn: () => this.closeModal() },
        { label: 'DESCEND', primary: true, fn: () => { this.closeModal(); this.descend(); } },
      ],
    };
  }

  descend() {
    this.stopAuto();
    sfx('stairs');
    const run = this.run;
    run.depth++;
    const self = this;
    setScene({
      t: 0,
      enter() {}, update(dt) { this.t += dt; if (this.t > 0.15 && !this.done) { this.done = true; self.loadFloor(null); setScene(self, 'fade'); } },
      draw(g) { g.fillStyle = '#07040c'; g.fillRect(0, 0, G.W, G.H); text(g, `FLOOR ${run.depth}`, G.W / 2, G.H / 2, '#e8e0c8', { align: 'center', scale: 2 }); },
    }, 'fade');
  }

  makeStock() {
    const d = this.run.depth;
    return [
      { kind: 'potion', price: 22 + d * 3, sold: false },
      { kind: 'potion', price: 22 + d * 3, sold: false },
      { kind: 'weapon', weapon: makeWeapon(rand, d + 1, null, rand.chance(0.4) ? 2 : 1), price: 0, sold: false },
      { kind: 'elixir', price: 70 + d * 6, sold: false },
      { kind: 'blessing', price: 120 + d * 10, sold: false },
    ].map(s => (s.kind === 'weapon' ? { ...s, price: 45 + d * 9 + s.weapon.rarity * 30 } : s));
  }

  shopDialog(e) {
    const run = this.run;
    const self = this;
    const dlg = {
      title: 'MERCHANT', sub: '"Bones and baubles, cheap!"',
      get options() {
        return e.stock.map(s => {
          const names = { potion: ['Life Bottle', `Heals ${potionHeal(run)} HP`], elixir: ['Bone Elixir', '+10 max HP'], blessing: ['Blessing Scroll', 'Choose a blessing'] };
          const [t, desc] = s.kind === 'weapon' ? [weaponName(s.weapon), ui.statLine(s.weapon, run)] : names[s.kind];
          const icon = s.kind === 'potion' || s.kind === 'elixir' ? SPR.potion : s.kind === 'weapon' ? weaponIcon(s.weapon.base) : SPR.star;
          return {
            title: s.sold ? t + ' (SOLD)' : t, desc, right: s.sold ? '' : String(s.price), icon,
            color: s.kind === 'weapon' ? RARITY[s.weapon.rarity].color : '#e8e0c8',
            disabled: s.sold || run.gold < s.price || (s.kind === 'potion' && !potionRoom(run)),
            fn: () => self.buy(e, s),
          };
        });
      },
      buttons: [{ label: `LEAVE (${run.gold}G)`, fn: () => this.closeModal() }],
    };
    return dlg;
  }

  buy(e, s) {
    const run = this.run;
    if (s.sold || run.gold < s.price || (s.kind === 'potion' && !potionRoom(run))) return;
    run.gold -= s.price; s.sold = true; sfx('buy');
    this.modal.buttons[0].label = `LEAVE (${run.gold}G)`;
    if (s.kind === 'potion') addPotions(run);
    else if (s.kind === 'elixir') { run.maxHp += 10; run.hp += 10; }
    else if (s.kind === 'blessing') { this.queue.unshift(this.modal); this.modal = this.blessingDialog('BLESSING', 'Choose wisely'); }
    else if (s.kind === 'weapon') { this.queue.unshift(this.modal); this.modal = this.weaponDialog(s.weapon, null); }
    this.save();
  }

  openMenu() {
    const run = this.run;
    const self = this;
    this.pushModal({
      title: 'PAUSED', sub: `Floor ${run.depth} - Level ${run.level} - ${run.kills} slain`,
      get options() {
        return [
          { title: 'Resume', fn: () => self.closeModal() },
          { title: `Sound: ${settings.sfx ? 'ON' : 'OFF'}`, fn: () => { settings.sfx = !settings.sfx; saveSettings(); } },
          { title: `Music: ${settings.music ? 'ON' : 'OFF'}`, fn: () => { settings.music = !settings.music; saveSettings(); } },
          { title: 'How to play', fn: () => { self.closeModal(); self.pushModal(howToDialog(() => self.closeModal())); } },
          { title: 'Open the wiki', desc: 'Your run is saved', fn: () => { self.save(); openWiki(); } },
          { title: 'Blessings', desc: Object.keys(run.bless).length ? Object.entries(run.bless).map(([k, n]) => `${k.toUpperCase()}${n > 1 ? ' X' + n : ''}`).join(', ') : 'None yet', fn: () => {} },
          { title: 'Abandon run', color: '#d04040', fn: () => self.confirmAbandon() },
        ];
      },
    });
  }

  confirmAbandon() {
    this.modal = {
      title: 'ABANDON?', body: ['Your hero will crumble and this run ends.'],
      buttons: [
        { label: 'NO', fn: () => this.closeModal() },
        { label: 'YES', fn: () => { this.modal = null; this.endRun(false); } },
      ],
    };
  }

  endRun(won) {
    clearSave();
    recordRunEnd(this.run);
    setScene(new Title(won ? 'victory' : null), 'fade');
  }

  usePotion() {
    const run = this.run;
    if (run.potions <= 0 || run.hp >= run.maxHp) { sfx('deny'); this.say(run.potions ? 'Already at full health.' : 'No Life Bottles.', '#8a7a9a'); return; }
    run.potions--;
    const h = potionHeal(run);
    run.hp = Math.min(run.maxHp, run.hp + h);
    sfx('potion');
    this.floatText('+' + h, this.player.x, this.player.y, '#7ac040');
    this.save();
  }

  selectWeapon(i) {
    const run = this.run;
    if (i === run.equipped) { this.pushModal({ title: 'WEAPON', weapon: run.weapons[i], buttons: [{ label: 'OK', fn: () => this.closeModal() }] }); return; }
    run.equipped = i; sfx('swap');
    this.say(`Equipped ${weaponName(run.weapons[i])}.`, RARITY[run.weapons[i].rarity].color);
  }

  say(t, col = '#e8e0c8') { this.msgs.push({ t: 0, text: t, col }); if (this.msgs.length > 3) this.msgs.shift(); }
  floatText(t, x, y, col) { this.fx.push({ kind: 'float', x, y, text: t, col, t: 0, life: 1.1 }); }

  // ---------- Rendering ----------
  isShown(e) {
    const i = this.idx(e.x, e.y);
    if (e.kind === 'enemy') return !!this.visible[i];
    return !!this.explored[i];
  }

  entSprite(e) {
    switch (e.kind) {
      case 'enemy': return SPR[e.type];
      case 'chest': return e.opened ? SPR.chestOpen : SPR.chest;
      case 'potion': return SPR.potion;
      case 'gold': return SPR.coins;
      case 'weapon': return weaponIcon(e.weapon.base);
      case 'fountain': return SPR.fountain;
      case 'merchant': return SPR.merchant;
      case 'altar': return SPR.altar;
      default: return null;
    }
  }

  draw(g) {
    const W = G.W, H = G.H, p = this.player, t = G.time;
    const e = p.t < 1 ? 1 - (1 - p.t) * (1 - p.t) : 1;
    const prx = p.fx + (p.x - p.fx) * e, pry = p.fy + (p.y - p.fy) * e;
    const hop = p.t < 1 ? Math.round(Math.sin(p.t * Math.PI) * 2) : 0;
    // Camera
    const tx = W / 2 - (prx - pry) * HW, ty = H * 0.47 - (prx + pry) * HH;
    if (this.camX == null) { this.camX = tx; this.camY = ty; }
    this.camX += (tx - this.camX) * 0.2; this.camY += (ty - this.camY) * 0.2;
    this.ox = Math.round(this.camX); this.oy = Math.round(this.camY);

    g.fillStyle = '#07040c'; g.fillRect(0, 0, W, H);
    const T = this.tiles, m = this.map, theme = this.theme;
    const vis = this.visible, exp = this.explored;
    const drawables = [];
    // Floors + flat decor
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const i = y * MW + x;
      if (!exp[i]) continue;
      const sx = (x - y) * HW + this.ox, sy = (x + y) * HH + this.oy;
      if (sx < -TW || sx > W + TW || sy < -TH - WH - 30 || sy > H + TH + 30) continue;
      if (m.tiles[i] === FLOOR) {
        let tile = theme.checker ? T.floors[(x + y) % 2] : T.floors[(x * 7 + y * 13 + ((x * y) % 5)) % 4];
        g.drawImage(vis[i] ? tile : dimmed(tile), sx - HW, sy - HH);
      } else if (m.edge[i]) {
        drawables.push({ k: x + y, kind: 'wall', x, y, sx, sy, lit: vis[i] });
      }
    }
    for (const d of m.decor) {
      const i = this.idx(d.x, d.y);
      if (!exp[i]) continue;
      const [sx, sy] = this.screenOf(d.x, d.y);
      const spr = SPR[d.type];
      if (d.block) drawables.push({ k: d.x + d.y, kind: 'spr', spr, sx, sy, lit: vis[i], decor: true, x: d.x, y: d.y });
      else { const s = vis[i] ? spr : dimmed(spr); g.drawImage(s, sx - (s.width >> 1) + d.ox, sy - (s.height >> 1) + d.oy); }
    }
    // Stairs (flat)
    for (const en of this.ents) if (en.kind === 'stairs' && exp[this.idx(en.x, en.y)]) {
      const [sx, sy] = this.screenOf(en.x, en.y);
      g.drawImage(vis[this.idx(en.x, en.y)] ? T.stairs : dimmed(T.stairs), sx - HW, sy - HH);
      g.globalAlpha = 0.45 + Math.sin(t * 5) * 0.3; g.drawImage(silhouetteSel(T, '#f0d050'), sx - HW, sy - HH); g.globalAlpha = 1;
    }
    // Path & target
    if (p.path.length) {
      for (const [x, y] of p.path) { const [sx, sy] = this.screenOf(x, y); g.fillStyle = 'rgba(255,251,234,0.5)'; g.fillRect(sx - 1, sy, 2, 1); }
    }
    if (this.target) {
      const [sx, sy] = this.screenOf(this.target[0], this.target[1]);
      g.globalAlpha = 0.5 + Math.sin(t * 8) * 0.3; g.drawImage(T.select, sx - HW, sy - HH); g.globalAlpha = 1;
    }
    for (const f of this.fx) if (f.kind === 'tap') {
      const [sx, sy] = this.screenOf(f.x, f.y);
      g.globalAlpha = Math.max(0, 1 - f.t * 2);
      g.drawImage(f.col === '#fffbea' ? T.select : silhouetteSel(T, f.col), sx - HW, sy - HH);
      g.globalAlpha = 1;
    }
    // Entities
    for (const en of this.ents) {
      if (en.kind === 'stairs' || !this.isShown(en)) continue;
      const spr = this.entSprite(en);
      if (!spr) continue;
      const [sx, sy] = this.screenOf(en.rx, en.ry);
      drawables.push({ k: Math.max(en.x + en.y, en.rx + en.ry) + 0.1, kind: 'ent', en, spr, sx, sy, lit: vis[this.idx(en.x, en.y)] });
    }
    const [psx, psy] = this.screenOf(prx, pry);
    drawables.push({ k: Math.max(p.x + p.y, prx + pry) + 0.1, kind: 'hero', sx: psx, sy: psy - hop });
    drawables.sort((a, b) => a.k - b.k || (a.kind === 'wall' ? -1 : 1));

    const pk = p.x + p.y, pd = p.x - p.y;
    for (const d of drawables) {
      if (d.kind === 'wall') {
        const near = d.k > pk && d.k <= pk + 3 && Math.abs((d.x - d.y) - pd) <= 3;
        const img = (d.x * 3 + d.y) % 5 === 0 ? T.wall2 : T.wall;
        g.globalAlpha = near ? 0.35 : 1;
        g.drawImage(d.lit ? img : dimmed(img), d.sx - HW, d.sy - HH - WH);
        g.globalAlpha = 1;
      } else if (d.kind === 'spr') {
        const near = d.k > pk && d.k <= pk + 2 && Math.abs((d.x - d.y) - pd) <= 2;
        g.globalAlpha = near ? 0.5 : 1;
        const s = d.lit ? d.spr : dimmed(d.spr);
        g.drawImage(s, d.sx - (s.width >> 1), d.sy - s.height + 3);
        g.globalAlpha = 1;
      } else if (d.kind === 'ent') this.drawEnt(g, d);
      else this.drawHero(g, d.sx, d.sy);
    }

    // Ambient motes
    for (const mo of this.motes) {
      g.globalAlpha = Math.min(1, mo.t, mo.life - mo.t) * 0.6;
      g.fillStyle = theme.mote; g.fillRect(Math.round(mo.x), Math.round(mo.y), 1, 1);
    }
    g.globalAlpha = 1;
    // Vignette lighting
    if (!this.vignette || this.vignette.width !== W || this.vignette.height !== H) this.vignette = makeVignette(W, H);
    g.drawImage(this.vignette, 0, 0);
    this.drawStairsBeacon(g, t);

    for (const f of this.fx) if (f.kind === 'float') {
      const [sx, sy] = this.screenOf(f.x, f.y);
      g.globalAlpha = Math.max(0, Math.min(1, (f.life - f.t) * 3));
      text(g, f.text, sx, sy - 22 - f.t * 14, f.col, { align: 'center', outline: '#140c1c' });
      g.globalAlpha = 1;
    }

    this.drawHud(g);
  }

  stairs() { return this.ents.find(e => e.kind === 'stairs' && this.explored[this.idx(e.x, e.y)]); }
  stairsBounds() { return { top: G.safeTop + 30, bot: G.H - G.safeBottom - ui.BAR_H - 10, m: 14 }; }
  stairsOnScreen(sx, sy) { const b = this.stairsBounds(); return sx >= b.m && sx <= G.W - b.m && sy - 46 >= b.top && sy <= b.bot; }

  // A pillar of light and a bobbing arrow so the way down is easy to spot.
  drawStairsBeacon(g, t) {
    const st = this.stairs();
    if (!st) return;
    const [sx, sy] = this.screenOf(st.x, st.y);
    if (sx < -30 || sx > G.W + 30 || sy < -10 || sy > G.H + 60) return;
    const p = this.player;
    const here = st.x === p.x && st.y === p.y;
    const pulse = 0.5 + Math.sin(t * 4) * 0.5;
    for (let i = 0; i < 40; i++) {
      const w = Math.max(1, Math.round(10 - i / 5));
      g.globalAlpha = (1 - i / 40) * (0.28 + pulse * 0.2);
      g.fillStyle = i % 3 ? '#f0d050' : '#fff6c0';
      g.fillRect(sx - w, sy - i, w * 2 + 1, 1);
    }
    g.globalAlpha = 1;
    // Rising sparks
    for (let k = 0; k < 4; k++) {
      const ph = (t * 0.7 + k / 4) % 1;
      g.globalAlpha = 1 - ph;
      g.fillStyle = '#fff6c0';
      g.fillRect(Math.round(sx + Math.sin(t * 3 + k * 2) * 5), Math.round(sy - 2 - ph * 30), 1, 1);
    }
    g.globalAlpha = 1;
    if (here || !this.stairsOnScreen(sx, sy)) return;
    const by = Math.round(sy - 46 + Math.sin(t * 5) * 3);
    text(g, 'STAIRS', sx, by - 8, '#f0d050', { align: 'center', outline: '#140c1c' });
    for (let r = 0; r < 5; r++) {
      g.fillStyle = '#140c1c'; g.fillRect(sx - 5 + r - 1, by + r - 1, (5 - r) * 2 + 3, 3);
    }
    for (let r = 0; r < 5; r++) { g.fillStyle = r < 2 ? '#fff6c0' : '#f0d050'; g.fillRect(sx - 5 + r, by + r, (5 - r) * 2 + 1, 1); }
  }

  // Edge-of-screen pointer to known stairs that are off screen (tap it to walk there), and a big
  // DESCEND button while standing on them.
  drawStairsHud(g, barY) {
    const st = this.stairs();
    if (!st || this.modal) return;
    const p = this.player, t = G.time;
    if (st.x === p.x && st.y === p.y) {
      if (this.player.t < 1 || p.path.length) return;
      const bw = 96, bh = 20, bx = Math.round((G.W - bw) / 2), by = Math.min(barY - 50, Math.round(G.H * 0.47) + 14);
      const glow = Math.floor(t * 3) % 2 === 0;
      ui.button(g, bx, by, bw, bh, 'DESCEND', () => this.descend(), {
        primary: true, scale: 2, fill: glow ? '#4a3a18' : '#3a2a10', border: '#f0d050', color: glow ? '#fff6c0' : '#f0d050',
      });
      return;
    }
    const [sx, sy] = this.screenOf(st.x, st.y);
    if (this.stairsOnScreen(sx, sy)) return;
    const { top, bot, m } = this.stairsBounds();
    const cx = G.W / 2, cy = (top + bot) / 2;
    const dx = sx - cx, dy = sy - cy;
    const k = Math.min((G.W / 2 - m) / Math.max(1e-3, Math.abs(dx)), ((bot - top) / 2 - m) / Math.max(1e-3, Math.abs(dy)));
    const ax = Math.round(cx + dx * k), ay = Math.round(cy + dy * k);
    const ang = Math.atan2(dy, dx), ux = Math.cos(ang), uy = Math.sin(ang);
    const bob = Math.sin(t * 6) * 2;
    const tipX = ax + ux * (4 + bob), tipY = ay + uy * (4 + bob);
    disc(g, ax, ay, 9, 'rgba(20,12,28,0.8)');
    ring(g, ax, ay, 9, '#f0d050');
    for (let i = 0; i < 7; i++) {
      const bx = tipX - ux * i, byy = tipY - uy * i, w = Math.floor(i * 0.6);
      line(g, bx - uy * w, byy + ux * w, bx + uy * w, byy - ux * w, '#f0d050');
    }
    const lx = Math.max(16, Math.min(G.W - 16, ax)), ly = ay + (ay > cy ? -17 : 12);
    text(g, 'STAIRS', lx, ly, '#f0d050', { align: 'center', outline: '#140c1c' });
    ui.hit(ax - 12, ay - 12, 24, 24, () => {
      if (this.auto) this.stopAuto();
      const path = this.findPath(st.x, st.y);
      if (!path) { sfx('deny'); return; }
      this.player.path = path; this.target = [st.x, st.y]; sfx('tap');
    });
  }

  drawEnt(g, d) {
    const { en, spr, sx, sy, lit } = d;
    const t = G.time;
    if (en.kind === 'enemy') {
      const def = ENEMIES[en.type];
      const fly = def.fly ? 6 + Math.round(Math.sin(t * 4 + en.id) * 2) : 0;
      const bob = Math.round(Math.sin(t * 3 + en.id) * 0.8);
      ellipse(g, sx, sy + 1, Math.round(spr.width * 0.35), 2, 'rgba(0,0,0,0.4)');
      const p = this.player;
      const s = en.x - en.y > p.x - p.y ? flipped(spr) : spr;
      g.drawImage(s, sx - (s.width >> 1), sy - s.height + 2 - fly + bob);
      if (en.boss) { g.globalAlpha = 0.25 + Math.sin(t * 3) * 0.15; ellipse(g, sx, sy + 1, spr.width * 0.6, 4, '#c070f0'); g.globalAlpha = 1; }
      if (en.alert > 0) text(g, '!', sx, sy - s.height - 8 - fly, '#ff5050', { align: 'center', scale: 2, outline: '#140c1c' });
      else if (!en.awake && Math.floor(t * 1.5 + en.id) % 3 === 0) text(g, 'Z', sx + 6, sy - s.height - 4 - (t * 4 % 4), '#a898b0', { outline: '#140c1c' });
      else if (en.stun > 0) g.drawImage(SPR.star, sx - 2, sy - s.height - 8);
      if (en.hp < en.maxHp) ui.bar(g, sx - 8, sy + 4, 16, 1, en.hp / en.maxHp, '#d04040');
      return;
    }
    const s = lit ? spr : dimmed(spr);
    let oy = 0;
    if (en.kind === 'weapon' || en.kind === 'potion' || en.kind === 'gold') {
      oy = Math.round(Math.sin(t * 3 + en.id) * 1.5) - 2;
      ellipse(g, sx, sy + 1, 4, 1, 'rgba(0,0,0,0.4)');
      if (en.kind === 'weapon' && lit) {
        g.globalAlpha = 0.3 + Math.sin(t * 4) * 0.2;
        ellipse(g, sx, sy, 7, 3, RARITY[en.weapon.rarity].color);
        g.globalAlpha = 1;
      }
    } else ellipse(g, sx, sy + 1, Math.round(s.width * 0.4), 2, 'rgba(0,0,0,0.4)');
    g.drawImage(s, sx - (s.width >> 1), sy - s.height + 3 + oy);
    if (en.kind === 'merchant' && lit) {
      g.globalAlpha = 0.25 + Math.sin(t * 5) * 0.1; ellipse(g, sx + 4, sy - 4, 6, 4, '#f0d050'); g.globalAlpha = 1;
    }
    if (en.kind === 'fountain' && !en.used && lit && Math.floor(t * 6) % 2) { g.fillStyle = '#c0f0ff'; g.fillRect(sx, sy - s.height + 1, 1, 1); }
  }

  drawHero(g, sx, sy) {
    const p = this.player, run = this.run;
    ellipse(g, sx, sy + 1, 5, 2, 'rgba(0,0,0,0.45)');
    const s = p.face < 0 ? flipped(SPR.hero) : SPR.hero;
    const ic = weaponIcon(run.weapons[run.equipped].base);
    const wx = p.face > 0 ? sx + 2 : sx - 2 - ic.width;
    const wimg = p.face > 0 ? ic : flipped(ic);
    g.drawImage(wimg, wx, sy - 16);
    g.drawImage(s, sx - (s.width >> 1), sy - s.height + 2);
  }

  drawHud(g) {
    const run = this.run, W = G.W;
    g.fillStyle = 'rgba(7,4,12,0.55)'; g.fillRect(0, 0, W, G.safeTop + 18);
    ui.statusHud(g, run, `${this.theme.name} ${run.depth}`);
    const barY = ui.actionBar(g, run, {
      onSlot: i => this.selectWeapon(i),
      onPotion: () => this.usePotion(),
      extras: [
        { label: this.auto ? 'STOP' : 'AUTO', fn: () => this.toggleAuto(), color: this.auto ? '#f0d050' : '#70d0e0' },
        { icon: SPR.menu, fn: () => this.openMenu() },
      ],
    });
    if (this.auto && Math.floor(G.time * 2) % 2 === 0) text(g, 'AUTOEXPLORING', W - 4, G.safeTop + 21, '#70d0e0', { align: 'right', outline: '#140c1c' });
    this.drawStairsHud(g, barY);
    this.msgs.forEach((m, i) => {
      g.globalAlpha = Math.min(1, (4 - m.t) * 2);
      text(g, m.text, 5, barY - 10 - (this.msgs.length - 1 - i) * 8, m.col, { outline: '#140c1c' });
      g.globalAlpha = 1;
    });
    if (this.banner) {
      const b = this.banner;
      const a = Math.max(0, Math.min(1, b.t * 3, (3 - b.t) * 2));
      g.globalAlpha = a;
      const y = Math.round(G.H * 0.2);
      g.fillStyle = 'rgba(7,4,12,0.7)'; g.fillRect(0, y - 4, W, b.sub ? 27 : 19);
      text(g, b.text, W / 2, y, '#e8e0c8', { align: 'center', scale: 2, outline: '#140c1c' });
      if (b.sub) text(g, b.sub, W / 2, y + 15, this.map.boss ? '#d04040' : '#a898b0', { align: 'center' });
      g.globalAlpha = 1;
    }
    if (this.modal) ui.dialog(g, this.modal, run);
  }
}

const selCache = new Map();
function silhouetteSel(T, col) {
  if (!selCache.has(col)) {
    const c = makeCanvas(T.select.width, T.select.height);
    const x = c.getContext('2d');
    x.drawImage(T.select, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    selCache.set(col, c);
  }
  return selCache.get(col);
}

function makeVignette(W, H) {
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');
  const cx = W / 2, cy = H * 0.47;
  const r1 = Math.min(W, H) * 0.32, r2 = Math.max(W, H) * 0.62;
  // Banded (posterized) radial darkness for a pixel-art look.
  const steps = 6;
  for (let s = steps; s >= 1; s--) {
    const r = r1 + ((r2 - r1) * s) / steps;
    x.fillStyle = 'rgba(7,4,12,0.13)';
    x.beginPath(); x.rect(0, 0, W, H); x.ellipse(cx, cy, r, r * 0.8, 0, 0, Math.PI * 2, true); x.fill();
  }
  return c;
}

