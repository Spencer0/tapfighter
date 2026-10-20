// Title screen, game over screen, and the how-to-play dialog.
import { G, setScene } from './engine.js';
import { text } from './font.js';
import { SPR } from './sprites.js';
import { THEMES } from './data.js';
import { sfx, playMusic, settings, saveSettings } from './audio.js';
import { rand } from './rng.js';
import { newRun, loadGame, clearSave, getRecords, recordRunEnd } from './state.js';
import { makeBackdrop } from './backdrop.js';
import * as ui from './ui.js';
import { Explore } from './explore.js';

// The wiki ships alongside the game at ./wiki/ (same tab so the autosave carries over).
export function openWiki() {
  sfx('tap');
  location.href = new URL('wiki/', document.baseURI).href;
}

export function howToDialog(onClose) {
  return {
    title: 'HOW TO PLAY',
    body: [
      { t: 'EXPLORE', c: '#f0d050' },
      'Tap a tile to walk there. Tap chests, fountains and merchants to use them. Find the stairs to descend.',
      { t: 'FIGHT', c: '#f0d050' },
      'Rings close over targets on the foe. Tap each one as the ring meets the center. PERFECT hits deal 150%.',
      { t: 'DEFEND', c: '#f0d050' },
      'When the foe attacks, tap SHIELDS on time to parry. Smash green ORBS. Never tap purple SKULLS - feints!',
      { t: 'BOTTOM BAR', c: '#f0d050' },
      'Swap weapons, drink Life Bottles, or RUN. Each weapon has its own rhythm.',
      { t: 'Level up to earn blessings. Death is permanent. Reach floor 15 and slay the Lich.', c: '#a898b0' },
    ],
    buttons: [{ label: 'GOT IT', primary: true, fn: onClose }],
  };
}

export class Title {
  constructor(mode = null) { this.mode = mode; this.t = 0; this.bats = []; this.modal = null; }
  enter() {
    playMusic('explore');
    this.save = loadGame();
    this.rec = getRecords();
    if (this.mode === 'victory') {
      this.modal = { title: 'LEGEND', titleColor: '#f0d050', body: ['Sir Rattlebone rests at last, his name sung in every tavern of the realm.'], buttons: [{ label: 'HUZZAH', primary: true, fn: () => { this.modal = null; } }] };
    }
  }
  resize() {
    this.horizon = Math.round(G.H * 0.62);
    this.bg = makeBackdrop(THEMES[0], G.W, G.H, this.horizon);
  }
  update(dt) {
    this.t += dt;
    if (this.bats.length < 5 && rand.chance(dt * 0.8)) this.bats.push({ x: -10, y: rand.range(20, G.H * 0.4), v: rand.range(25, 50), ph: rand.range(0, 6) });
    for (const b of this.bats) b.x += b.v * dt;
    this.bats = this.bats.filter(b => b.x < G.W + 20);
  }
  start(cont) {
    sfx('stairs');
    let ex;
    if (cont && this.save) {
      try { ex = new Explore(this.save.run, this.save.floor); } catch (e) { console.error(e); clearSave(); ex = new Explore(newRun()); }
    } else { clearSave(); ex = new Explore(newRun()); }
    setScene(ex, 'diamond');
  }
  draw(g) {
    const W = G.W, H = G.H;
    g.drawImage(this.bg, 0, 0);
    for (const b of this.bats) {
      const f = Math.floor(this.t * 10 + b.ph) % 2;
      g.fillStyle = '#140c1c';
      const x = Math.round(b.x), y = Math.round(b.y + Math.sin(this.t * 3 + b.ph) * 4);
      g.fillRect(x - 1, y, 3, 2);
      if (f) { g.fillRect(x - 4, y - 2, 3, 1); g.fillRect(x + 2, y - 2, 3, 1); } else { g.fillRect(x - 4, y + 1, 3, 1); g.fillRect(x + 2, y + 1, 3, 1); }
    }
    const top = G.safeTop + Math.round(H * 0.08);
    const sc = W >= 260 ? 4 : 3;
    text(g, 'TAPFIGHTER', W / 2 + 2, top + 2, '#2a1030', { align: 'center', scale: sc });
    text(g, 'TAPFIGHTER', W / 2, top, '#f0d050', { align: 'center', scale: sc, outline: '#4a2010' });
    g.fillStyle = 'rgba(255,255,255,0.35)';
    text(g, 'THE BONEYARD CRAWL', W / 2, top + 6 * sc + 6, '#c8b8e0', { align: 'center', outline: '#140c1c' });
    // Hero
    const z = H > 420 ? 4 : 3;
    const hs = SPR.hero;
    const hx = Math.round(W / 2 - (hs.width * z) / 2), hy = Math.round(this.horizon + 6 - hs.height * z + Math.sin(this.t * 2) * 2);
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(hx + 4, this.horizon + 4, hs.width * z - 8, 4);
    const ic = SPR.w_sword;
    g.save(); g.translate(hx + hs.width * z * 0.86, hy + hs.height * z * 0.66); g.rotate(-0.4 + Math.sin(this.t * 2) * 0.1);
    g.drawImage(ic, -2 * (z - 1), -(ic.height - 2) * (z - 1), ic.width * (z - 1), ic.height * (z - 1)); g.restore();
    g.drawImage(hs, hx, hy, hs.width * z, hs.height * z);

    const bw = Math.min(150, W - 40), bx = Math.round((W - bw) / 2);
    let by = Math.round(this.horizon + 18);
    if (this.save) {
      ui.button(g, bx, by, bw, 22, 'CONTINUE', () => this.start(true), { primary: true, scale: 1 });
      text(g, `FLOOR ${this.save.run.depth} - LV ${this.save.run.level}`, W / 2, by + 24, '#8a7a9a', { align: 'center' });
      by += 34;
      ui.button(g, bx, by, bw, 18, 'NEW RUN', () => {
        this.modal = { title: 'NEW RUN?', body: ['Your current hero will be lost.'], buttons: [{ label: 'NO', fn: () => { this.modal = null; } }, { label: 'YES', primary: true, fn: () => { this.modal = null; recordRunEnd(this.save.run); this.start(false); } }] };
      });
    } else {
      ui.button(g, bx, by, bw, 22, 'NEW RUN', () => this.start(false), { primary: true });
    }
    by += 24;
    const third = Math.floor((bw - 8) / 3);
    ui.button(g, bx, by, third, 18, 'HOW TO', () => { this.modal = howToDialog(() => { this.modal = null; }); });
    ui.button(g, bx + third + 4, by, third, 18, 'WIKI', openWiki, { color: '#f0d050' });
    ui.button(g, bx + (third + 4) * 2, by, bw - (third + 4) * 2, 18, settings.music || settings.sfx ? 'SOUND' : 'MUTED', () => {
      const on = !(settings.music || settings.sfx);
      settings.music = on; settings.sfx = on; saveSettings();
    });
    const r = this.rec;
    if (r.runs > 0) text(g, `BEST FLOOR ${r.bestDepth}  RUNS ${r.runs}  WINS ${r.wins}`, W / 2, H - G.safeBottom - 10, '#6a5a78', { align: 'center' });
    if (this.modal) ui.dialog(g, this.modal, null);
  }
}

export class GameOver {
  constructor(run, killer) {
    this.run = run; this.killer = killer; this.t = 0;
    clearSave();
    this.rec = recordRunEnd(run);
  }
  enter() { playMusic(null); }
  resize() {}
  update(dt) { this.t += dt; }
  draw(g) {
    const W = G.W, H = G.H, run = this.run;
    g.fillStyle = '#07040c'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 30; i++) { g.fillStyle = '#1a0e20'; g.fillRect((i * 37) % W, (i * 53 + Math.floor(this.t * 10)) % H, 1, 2); }
    const y0 = G.safeTop + Math.round(H * 0.12);
    text(g, 'YOU HAVE', W / 2, y0, '#8a2a2a', { align: 'center', scale: 3 });
    text(g, 'FALLEN', W / 2, y0 + 20, '#d04040', { align: 'center', scale: 4, outline: '#2a0a10' });
    const sk = SPR.skullIcon;
    g.drawImage(sk, Math.round(W / 2 - sk.width * 2), y0 + 48, sk.width * 4, sk.height * 4);
    const lines = [
      `SLAIN BY ${this.killer}`,
      `FLOOR ${run.depth}`,
      `LEVEL ${run.level}`,
      `${run.kills} FOES DESTROYED`,
      `${run.gold} GOLD HOARDED`,
      `BEST COMBO ${run.bestCombo || 0}`,
    ];
    lines.forEach((l, i) => text(g, l, W / 2, y0 + 90 + i * 10, i === 0 ? '#e8e0c8' : '#a898b0', { align: 'center' }));
    const best = this.rec.bestDepth === run.depth ? 'NEW BEST!' : `BEST FLOOR ${this.rec.bestDepth}`;
    text(g, best, W / 2, y0 + 160, '#f0d050', { align: 'center' });
    if (this.t > 1) {
      const bw = Math.min(150, W - 40), bx = Math.round((W - bw) / 2);
      ui.button(g, bx, y0 + 178, bw, 22, 'RISE AGAIN', () => { sfx('stairs'); setScene(new Explore(newRun()), 'diamond'); }, { primary: true });
      ui.button(g, bx, y0 + 204, bw, 18, 'TITLE', () => setScene(new Title(), 'fade'));
    }
  }
}

