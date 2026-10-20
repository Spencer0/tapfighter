// Immediate-mode pixel UI: hit regions, panels, buttons, dialogs, HUD bars.
import { G } from './engine.js';
import { text, textWidth, wrap } from './font.js';
import { SPR, weaponIcon } from './sprites.js';
import { RARITY, weaponName, weaponStats, weaponTraits, xpNeed, WEAPONS } from './data.js';

export const COL = {
  bg: '#0d0815', panel: '#1c1228', panel2: '#2a1d3a', border: '#5a4070', hi: '#7a5a90',
  gold: '#f0d050', text: '#e8e0c8', dim: '#8a7a9a', red: '#d04040', green: '#7ac040', blue: '#5ab0f0', dark: '#07040c',
};

export function hit(x, y, w, h, fn) { G.hits.push({ x, y, w, h, fn }); }
export function modalBegin() { G.modalIndex = G.hits.length; }
export function pressed(x, y, w, h) {
  const p = G.press;
  return p && G.time - p.t < 0.12 && p.x >= x && p.x < x + w && p.y >= y && p.y < y + h;
}

export function panel(g, x, y, w, h, fill = COL.panel, border = COL.border) {
  x = Math.round(x); y = Math.round(y);
  g.fillStyle = COL.dark; g.fillRect(x + 1, y - 1, w - 2, h + 2); g.fillRect(x - 1, y + 1, w + 2, h - 2);
  g.fillStyle = border; g.fillRect(x + 1, y, w - 2, h); g.fillRect(x, y + 1, w, h - 2);
  g.fillStyle = fill; g.fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x + 2, y + 1, w - 4, 1);
}

export function button(g, x, y, w, h, label, fn, o = {}) {
  const dis = !!o.disabled;
  const down = !dis && pressed(x, y, w, h);
  const fill = dis ? '#1a1420' : down ? '#3a2850' : o.fill || COL.panel2;
  panel(g, x, y + (down ? 1 : 0), w, h, fill, dis ? '#3a3040' : o.border || (o.primary ? COL.gold : COL.border));
  const tc = dis ? '#5a5060' : o.color || (o.primary ? COL.gold : COL.text);
  const sc = o.scale || 1;
  if (o.icon) {
    const ic = o.icon;
    const tw = label ? textWidth(label, sc) + 3 : 0;
    const ix = Math.round(x + (w - ic.width - tw) / 2);
    g.drawImage(ic, ix, Math.round(y + (h - ic.height) / 2) + (down ? 1 : 0));
    if (label) text(g, label, ix + ic.width + 3, y + Math.round((h - 5 * sc) / 2) + (down ? 1 : 0), tc, { scale: sc });
  } else {
    text(g, label, x + w / 2, y + Math.round((h - 5 * sc) / 2) + (down ? 1 : 0), tc, { align: 'center', scale: sc });
  }
  if (!dis) hit(x, y, w, h, fn);
}

export function bar(g, x, y, w, h, frac, col, back = '#2a1d33', ghost = null) {
  x = Math.round(x); y = Math.round(y);
  g.fillStyle = COL.dark; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = back; g.fillRect(x, y, w, h);
  if (ghost != null) { g.fillStyle = '#fffbea'; g.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, ghost))), h); }
  g.fillStyle = col; g.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), h);
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), 1);
}

export function statLine(w, run) {
  const s = weaponStats(w, run);
  return `DMG ${s.dmg} X${s.strikes}  LV${w.lvl}`;
}

// Weapon card used inside dialogs. Returns height used.
export function weaponCard(g, w, x, y, width, run, draw = true) {
  const s = weaponStats(w, run);
  const traits = weaponTraits(w).flatMap(t => wrap(t, width - 30));
  const h = 38 + traits.length * 7;
  if (!draw) return h;
  panel(g, x, y, width, h, '#140c1c', RARITY[w.rarity].color);
  const ic = weaponIcon(w.base);
  g.drawImage(ic, x + 4, y + 4, ic.width * 2, ic.height * 2);
  const tx = x + 36;
  text(g, weaponName(w), tx, y + 5, RARITY[w.rarity].color);
  text(g, `${RARITY[w.rarity].name} LV ${w.lvl}`, tx, y + 12, COL.dim);
  text(g, `DMG ${s.dmg} X ${s.strikes}`, tx, y + 19, COL.text);
  text(g, `TIMING ${s.perfect}MS`, tx, y + 26, COL.text);
  traits.forEach((t, i) => text(g, t, x + 6, y + 35 + i * 7, '#b8a8c8'));
  return h;
}

// Generic dialog: {title, sub, body[], weapon, options[{title,desc,right,color,icon,fn,disabled}], buttons[{label,fn,primary}]}
export function dialog(g, d, run) {
  modalBegin();
  g.fillStyle = 'rgba(5,2,10,0.72)'; g.fillRect(0, 0, G.W, G.H);
  const w = Math.min(G.W - 12, 220);
  const inner = w - 16;
  const subLines = d.sub ? wrap(d.sub, inner) : [];
  const body = (d.body || []).flatMap(b => (typeof b === 'string' ? wrap(b, inner).map(t => ({ t })) : wrap(b.t, inner).map(t => ({ t, c: b.c }))));
  const opts = d.options || [];
  const optH = o => 12 + (o.desc ? wrap(o.desc, inner - (o.icon ? 30 : 8) - (o.right ? textWidth(o.right) + 6 : 0)).length * 7 : 0) + (o.icon ? 4 : 0);
  let h = 10;
  if (d.title) h += 14;
  h += subLines.length * 7 + (subLines.length ? 4 : 0);
  h += body.length * 7 + (body.length ? 4 : 0);
  if (d.weapon) h += weaponCard(g, d.weapon, 0, 0, inner, run, false) + 6;
  for (const o of opts) h += Math.max(20, optH(o)) + 4;
  if (d.buttons && d.buttons.length) h += 24;
  const x = Math.round((G.W - w) / 2);
  let y = Math.max(G.safeTop + 4, Math.round((G.H - h) / 2));
  panel(g, x, y, w, h, COL.panel, d.border || COL.border);
  let cy = y + 8;
  if (d.title) { text(g, d.title, x + w / 2, cy, d.titleColor || COL.gold, { align: 'center', scale: 2, shadow: COL.dark }); cy += 14; }
  for (const l of subLines) { text(g, l, x + w / 2, cy, COL.dim, { align: 'center' }); cy += 7; }
  if (subLines.length) cy += 4;
  for (const l of body) { text(g, l.t, x + 8, cy, l.c || COL.text); cy += 7; }
  if (body.length) cy += 4;
  if (d.weapon) { cy += weaponCard(g, d.weapon, x + 8, cy, inner, run) + 6; }
  for (const o of opts) {
    const oh = Math.max(20, optH(o));
    const dis = !!o.disabled;
    const down = !dis && pressed(x + 8, cy, inner, oh);
    panel(g, x + 8, cy + (down ? 1 : 0), inner, oh, dis ? '#1a1420' : down ? '#3a2850' : COL.panel2, dis ? '#3a3040' : o.border || COL.border);
    let tx = x + 13;
    if (o.icon) { g.drawImage(o.icon, x + 12, cy + Math.round((oh - o.icon.height * 2) / 2), o.icon.width * 2, o.icon.height * 2); tx = x + 12 + o.icon.width * 2 + 4; }
    text(g, o.title, tx, cy + 4 + (down ? 1 : 0), dis ? '#6a6070' : o.color || COL.text);
    if (o.right) text(g, o.right, x + 8 + inner - 5, cy + 4, dis ? '#6a6070' : COL.gold, { align: 'right' });
    if (o.desc) wrap(o.desc, inner - (o.icon ? 30 : 8) - (o.right ? textWidth(o.right) + 6 : 0)).forEach((l, i) => text(g, l, tx, cy + 11 + i * 7, dis ? '#5a5060' : '#a898b8'));
    if (!dis) hit(x + 8, cy, inner, oh, o.fn);
    cy += oh + 4;
  }
  if (d.buttons && d.buttons.length) {
    const n = d.buttons.length;
    const bw = Math.floor((inner - (n - 1) * 4) / n);
    d.buttons.forEach((b, i) => button(g, x + 8 + i * (bw + 4), cy + 2, bw, 18, b.label, b.fn, b));
  }
}

// Top HUD: HP, level/xp, gold and a right-side label.
export function statusHud(g, run, label) {
  const y = G.safeTop + 4;
  g.drawImage(SPR.heart, 3, y - 1);
  const hpW = Math.min(70, Math.floor(G.W * 0.3));
  bar(g, 14, y, hpW, 6, run.hp / run.maxHp, run.hp / run.maxHp < 0.3 ? COL.red : '#c83c3c', '#3a1420');
  text(g, `${run.hp}/${run.maxHp}`, 16 + hpW + 3, y + 1, COL.text, { outline: COL.dark });
  text(g, `LV${run.level}`, 4, y + 10, COL.gold, { outline: COL.dark });
  bar(g, 22, y + 11, hpW - 8, 2, run.xp / xpNeed(run.level), COL.blue, '#1a2040');
  const gold = String(run.gold);
  text(g, gold, G.W - 4, y + 1, COL.gold, { align: 'right', outline: COL.dark });
  g.drawImage(SPR.coin, G.W - 6 - textWidth(gold) - SPR.coin.width, y - 1);
  if (label) text(g, label, G.W - 4, y + 10, COL.dim, { align: 'right', outline: COL.dark });
}

export const BAR_H = 42;
// Bottom action bar: 3 weapon slots, life bottle, plus extra buttons.
export function actionBar(g, run, { onSlot, onPotion, extras = [], potionDisabled = false }) {
  const y = G.H - G.safeBottom - BAR_H;
  g.fillStyle = COL.bg; g.fillRect(0, y - 3, G.W, BAR_H + 3 + G.safeBottom);
  g.fillStyle = '#3a2a4a'; g.fillRect(0, y - 3, G.W, 1);
  g.fillStyle = '#1a1024'; g.fillRect(0, y - 2, G.W, 1);
  const slot = 34, gap = 4, ew = 30;
  const total = slot * 4 + extras.length * ew + gap * (3 + extras.length);
  let x = Math.round((G.W - total) / 2);
  const sy = y + 4;
  for (let i = 0; i < 3; i++) {
    const w = run.weapons[i];
    const eq = i === run.equipped && !!w;
    const down = w && pressed(x, sy, slot, slot);
    panel(g, x, sy + (down ? 1 : 0), slot, slot, eq ? '#3a2850' : '#170f20', eq ? COL.gold : w ? RARITY[w.rarity].color : '#2a2034');
    if (w) {
      const ic = weaponIcon(w.base);
      g.drawImage(ic, x + 3, sy + 2 + (down ? 1 : 0), ic.width * 2, ic.height * 2);
      text(g, String(weaponStats(w, run).dmg), x + slot - 3, sy + slot - 7, eq ? COL.gold : COL.text, { align: 'right', outline: COL.dark });
      if (eq) { g.fillStyle = COL.gold; g.fillRect(x + 3, sy + slot - 3, slot - 6, 1); }
      const fi = i;
      hit(x, sy, slot, slot, () => onSlot(fi));
    } else {
      text(g, 'EMPTY', x + slot / 2, sy + 14, '#3a3044', { align: 'center' });
    }
    x += slot + gap;
  }
  const pd = potionDisabled || run.potions <= 0;
  const down = !pd && pressed(x, sy, slot, slot);
  panel(g, x, sy + (down ? 1 : 0), slot, slot, pd ? '#140c18' : '#2a1420', pd ? '#3a2a34' : '#a04050');
  g.globalAlpha = pd ? 0.4 : 1;
  g.drawImage(SPR.potion, x + 10, sy + 5 + (down ? 1 : 0), SPR.potion.width * 2, SPR.potion.height * 2);
  g.globalAlpha = 1;
  text(g, 'X' + run.potions, x + slot - 3, sy + slot - 7, pd ? COL.dim : COL.text, { align: 'right', outline: COL.dark });
  if (!pd) hit(x, sy, slot, slot, onPotion);
  x += slot + gap;
  for (const e of extras) {
    button(g, x, sy, ew, slot, e.label || '', e.fn, { icon: e.icon, disabled: e.disabled, color: e.color, fill: '#170f20' });
    x += ew + gap;
  }
  return y;
}

export const weaponBaseName = base => WEAPONS[base].name;
