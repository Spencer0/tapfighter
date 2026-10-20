// Procedural isometric tile art (2:1 diamonds, raised wall blocks) per theme.
import { makeCanvas, hexRgb } from './gfx.js';
import { RNG } from './rng.js';

export const TW = 24, TH = 12, WH = 14;

// Column spans of a 24x12 diamond: calls fn(x, yTop, yBottom) inclusive.
function diamondCols(fn) {
  for (let x = 0; x < TW; x++) {
    const d = x < TW / 2 ? x : TW - 1 - x;
    fn(x, 5 - (d >> 1), 6 + (d >> 1));
  }
}

function shade(hex, f) {
  const [r, g, b] = hexRgb(hex);
  const c = v => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

function floorTile(theme, variant, rng) {
  const c = makeCanvas(TW, TH);
  const x = c.getContext('2d');
  const base = theme.floor[variant % theme.floor.length];
  diamondCols((cx, y0, y1) => {
    for (let y = y0; y <= y1; y++) {
      let col = base;
      const n = rng.next();
      if (n < 0.12) col = shade(base, 1.12); else if (n < 0.22) col = shade(base, 0.88);
      if (y === y0 && cx < TW / 2) col = theme.floorHi;
      else if (y === y1) col = theme.floorLo;
      else if (y === y0) col = shade(base, 1.06);
      x.fillStyle = col; x.fillRect(cx, y, 1, 1);
    }
  });
  if (theme.id === 'graveyard' && rng.chance(0.6)) {
    for (let i = 0; i < 3; i++) {
      const px = rng.int(6, 17), py = rng.int(4, 8);
      x.fillStyle = theme.floorHi; x.fillRect(px, py, 1, 1);
      x.fillRect(px + 2, py - 1, 1, 1);
    }
  }
  if (theme.id === 'crypt') {
    x.fillStyle = theme.floorLo;
    if (variant % 2) for (let i = 0; i < 6; i++) x.fillRect(6 + i * 2, 3 + i, 1, 1);
  }
  return c;
}

function wallBlock(theme, rng) {
  const c = makeCanvas(TW, TH + WH);
  const x = c.getContext('2d');
  diamondCols((cx, y0, y1) => {
    for (let y = y0; y <= y1; y++) {
      let col = theme.wallTop;
      const n = rng.next();
      if (n < 0.15) col = shade(theme.wallTop, 1.1); else if (n < 0.3) col = shade(theme.wallTop, 0.9);
      if (theme.id === 'graveyard' && rng.chance(0.25)) col = theme.moss;
      if (y === y0) col = shade(theme.wallTop, 1.2);
      x.fillStyle = col; x.fillRect(cx, y, 1, 1);
    }
    const left = cx < TW / 2;
    const face = left ? theme.wallL : theme.wallR;
    for (let k = 1; k <= WH; k++) {
      const y = y1 + k;
      let col = face;
      const brickRow = Math.floor((k - 1) / 4);
      if ((k - 1) % 4 === 3) col = theme.mortar;
      else if (((cx + (brickRow % 2) * 3) % 6) === 0) col = theme.mortar;
      else if (rng.chance(0.1)) col = shade(face, 1.15);
      if (k === WH) col = shade(face, 0.6);
      x.fillStyle = col; x.fillRect(cx, y, 1, 1);
    }
  });
  return c;
}

function stairsTile(theme) {
  const c = makeCanvas(TW, TH);
  const x = c.getContext('2d');
  diamondCols((cx, y0, y1) => {
    for (let y = y0; y <= y1; y++) { x.fillStyle = theme.floorLo; x.fillRect(cx, y, 1, 1); }
  });
  const steps = ['#5a5262', '#463e4e', '#322a3a', '#201828', '#0c0812'];
  steps.forEach((col, i) => {
    const s = 10 - i * 2;
    for (let cx = 12 - s; cx < 12 + s; cx++) {
      const d = Math.abs(cx - 11.5) - 0.5;
      const half = Math.max(0, Math.floor((s - d) / 2));
      x.fillStyle = col;
      x.fillRect(cx, 6 - half + i, 1, Math.max(1, half * 2 - i));
    }
  });
  return c;
}

const cache = new Map();
export function getTiles(theme) {
  if (cache.has(theme.id)) return cache.get(theme.id);
  const rng = new RNG(theme.id.length * 7919);
  const t = {
    floors: [0, 1, 2, 3].map(v => floorTile(theme, v, rng)),
    wall: wallBlock(theme, rng),
    wall2: wallBlock(theme, rng),
    stairs: stairsTile(theme),
  };
  // A soft cursor/selection diamond outline.
  const sel = makeCanvas(TW, TH);
  const sx = sel.getContext('2d');
  diamondCols((cx, y0, y1) => { sx.fillStyle = '#fffbea'; sx.fillRect(cx, y0, 1, 1); sx.fillRect(cx, y1, 1, 1); });
  t.select = sel;
  const fill = makeCanvas(TW, TH);
  const fx = fill.getContext('2d');
  diamondCols((cx, y0, y1) => { fx.fillStyle = '#ffffff'; fx.fillRect(cx, y0, 1, y1 - y0 + 1); });
  t.fill = fill;
  cache.set(theme.id, t);
  return t;
}
