// Painted 2.5D backdrops for battle and title screens (sky, silhouettes, perspective floor).
import { makeCanvas, disc, ellipse, line, hexRgb } from './gfx.js';
import { RNG } from './rng.js';

function mix(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}

// Dithered vertical gradient through a list of colors.
function bands(g, y0, y1, W, cols) {
  const h = y1 - y0;
  for (let y = 0; y < h; y++) {
    const p = (y / Math.max(1, h)) * (cols.length - 1);
    const i = Math.min(cols.length - 2, Math.floor(p));
    const f = p - i;
    const step = Math.floor(f * 4) / 4;
    for (let x = 0; x < W; x += 2) {
      const dither = ((x >> 1) + y) % 2 === 0 ? 0.125 : -0.125;
      g.fillStyle = mix(cols[i], cols[i + 1], Math.max(0, Math.min(1, step + dither)));
      g.fillRect(x, y0 + y, 2, 1);
    }
  }
}

function deadTree(g, x, y, h, col, rng) {
  g.fillStyle = col;
  g.fillRect(x - 1, y - h, 3, h);
  const branch = (bx, by, len, dir, depth) => {
    let cx = bx, cy = by;
    for (let i = 0; i < len; i++) {
      cx += dir; cy -= rng.chance(0.6) ? 1 : 0;
      g.fillRect(cx, cy, 1 + (depth > 1 ? 1 : 0), 1);
      if (depth > 0 && rng.chance(0.12)) branch(cx, cy, Math.floor(len * 0.6), rng.chance(0.5) ? 1 : -1, depth - 1);
    }
  };
  for (let i = 0; i < 4; i++) branch(x, y - h + rng.int(0, Math.floor(h * 0.5)), rng.int(6, 14), i % 2 ? 1 : -1, 2);
}

export function makeBackdrop(theme, W, H, horizon) {
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const rng = new RNG(theme.id.length * 1013 + W);
  bands(g, 0, horizon, W, theme.sky);

  if (theme.id === 'graveyard') {
    for (let i = 0; i < 40; i++) { g.fillStyle = rng.chance(0.3) ? '#fffbea' : '#8a80b0'; g.fillRect(rng.int(0, W), rng.int(0, horizon - 20), 1, 1); }
    const mx = Math.round(W * 0.72), my = Math.round(horizon * 0.35), mr = Math.max(14, Math.round(W * 0.09));
    disc(g, mx, my, mr + 4, 'rgba(200,210,240,0.08)');
    disc(g, mx, my, mr + 2, 'rgba(200,210,240,0.12)');
    disc(g, mx, my, mr, '#e8e4d0');
    disc(g, mx - 4, my - 3, Math.round(mr * 0.25), '#c8c4b4');
    disc(g, mx + 5, my + 4, Math.round(mr * 0.18), '#c8c4b4');
    for (let i = 0; i < 5; i++) {
      const cy = rng.int(10, horizon - 30), cx = rng.int(-20, W);
      g.fillStyle = 'rgba(40,30,70,0.7)';
      g.fillRect(cx, cy, rng.int(30, 70), 2); g.fillRect(cx + 6, cy - 1, rng.int(14, 30), 1);
    }
    // Rolling hills
    for (let layer = 0; layer < 2; layer++) {
      g.fillStyle = layer ? '#141022' : '#1e1832';
      for (let x = 0; x < W; x++) {
        const hgt = Math.round(10 + layer * -4 + Math.sin(x * 0.03 + layer * 2) * 6 + Math.sin(x * 0.011) * 8);
        g.fillRect(x, horizon - hgt - (1 - layer) * 6, 1, hgt + 8);
      }
    }
    for (let i = 0; i < 4; i++) deadTree(g, rng.int(0, W), horizon - 2, rng.int(18, 34), '#0e0a18', rng);
    for (let i = 0; i < 9; i++) {
      const gx = rng.int(0, W), gh = rng.int(5, 9);
      g.fillStyle = '#0e0a18';
      if (rng.chance(0.5)) { g.fillRect(gx, horizon - gh, 5, gh); g.fillRect(gx + 1, horizon - gh - 1, 3, 1); }
      else { g.fillRect(gx + 2, horizon - gh - 2, 1, gh + 2); g.fillRect(gx, horizon - gh, 5, 1); }
    }
  } else if (theme.id === 'crypt') {
    // Brick back wall with arches and torches
    g.fillStyle = '#1a141c'; g.fillRect(0, 0, W, horizon);
    for (let y = 0; y < horizon; y += 5) {
      g.fillStyle = '#120e14'; g.fillRect(0, y, W, 1);
      for (let x = ((y / 5) % 2) * 6; x < W; x += 12) g.fillRect(x, y, 1, 5);
    }
    const n = Math.max(2, Math.round(W / 90));
    for (let i = 0; i < n; i++) {
      const ax = Math.round((W / n) * (i + 0.5)), aw = 26, ah = Math.round(horizon * 0.55);
      g.fillStyle = '#07050a';
      g.fillRect(ax - aw / 2, horizon - ah + aw / 2, aw, ah - aw / 2);
      disc(g, ax, horizon - ah + aw / 2, aw / 2, '#07050a');
      g.fillStyle = '#3a2e2a';
      g.fillRect(ax - aw / 2 - 3, horizon - ah + aw / 2, 3, ah - aw / 2);
      g.fillRect(ax + aw / 2, horizon - ah + aw / 2, 3, ah - aw / 2);
      const tx = Math.round(ax + W / n / 2);
      if (i < n - 1 || n === 1) {
        disc(g, tx, horizon - ah + 6, 10, 'rgba(240,150,60,0.08)');
        disc(g, tx, horizon - ah + 6, 6, 'rgba(240,150,60,0.12)');
        g.fillStyle = '#4e3022'; g.fillRect(tx - 1, horizon - ah + 6, 3, 6);
        g.fillStyle = '#f0a040'; g.fillRect(tx - 1, horizon - ah + 2, 3, 4);
        g.fillStyle = '#fff0a0'; g.fillRect(tx, horizon - ah + 3, 1, 2);
      }
    }
    for (let i = 0; i < 12; i++) { g.fillStyle = '#e8e0c8'; const sx = rng.int(0, W), sy = rng.int(horizon - 10, horizon - 3); g.fillRect(sx, sy, 2, 1); }
  } else {
    // Cathedral: stained glass rose window and columns
    g.fillStyle = '#140c1e'; g.fillRect(0, 0, W, horizon);
    const wx = Math.round(W / 2), wy = Math.round(horizon * 0.42), wr = Math.min(Math.round(horizon * 0.34), Math.round(W * 0.2));
    disc(g, wx, wy, wr + 6, 'rgba(160,80,220,0.10)');
    disc(g, wx, wy, wr + 2, '#2a1e30');
    const glass = ['#c83c3c', '#4060b0', '#9a58c0', '#f0d050', '#7ac040', '#70d0e0'];
    for (let y = -wr; y <= wr; y++) for (let x = -wr; x <= wr; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d > wr) continue;
      const a = Math.atan2(y, x);
      const seg = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8);
      const ringI = Math.floor((d / wr) * 3);
      const lead = Math.abs(((a + Math.PI) / (Math.PI * 2)) * 8 - Math.round(((a + Math.PI) / (Math.PI * 2)) * 8)) < 0.08 || Math.abs(d / wr * 3 - Math.round(d / wr * 3)) < 0.1;
      g.fillStyle = lead ? '#1a121e' : glass[(seg + ringI * 3) % glass.length];
      g.globalAlpha = lead ? 1 : 0.75;
      g.fillRect(wx + x, wy + y, 1, 1);
    }
    g.globalAlpha = 1;
    const cols = Math.max(2, Math.round(W / 70));
    for (let i = 0; i <= cols; i++) {
      const px = Math.round((W / cols) * i);
      g.fillStyle = '#241a30'; g.fillRect(px - 6, 0, 12, horizon);
      g.fillStyle = '#342646'; g.fillRect(px - 6, 0, 3, horizon);
      g.fillStyle = '#18101f'; g.fillRect(px + 4, 0, 2, horizon);
    }
    // light shafts
    g.fillStyle = 'rgba(200,160,255,0.05)';
    for (let y = wy; y < H; y++) { const s = (y - wy) * 0.5; g.fillRect(wx - wr / 2 - s, y, wr + s * 2, 1); }
  }

  // Perspective floor
  g.fillStyle = theme.ground; g.fillRect(0, horizon, W, H - horizon);
  const vx = W / 2, vy = horizon - Math.round(H * 0.25);
  g.fillStyle = theme.groundLine;
  let y = horizon + 2, gap = 2;
  while (y < H) { g.fillRect(0, Math.round(y), W, 1); gap *= 1.35; y += gap; }
  for (let i = -12; i <= 12; i++) {
    const bx = vx + i * W * 0.18;
    const t0 = (horizon - vy) / (H - vy);
    line(g, vx + (bx - vx) * t0, horizon, bx, H, theme.groundLine);
  }
  // Fog near horizon
  for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(150,140,190,${0.05 - i * 0.007})`; g.fillRect(0, horizon - 3 + i * 2, W, 2); }
  // Floor detritus
  for (let i = 0; i < 18; i++) {
    const fx = rng.int(0, W), fy = rng.int(horizon + 6, H);
    if (theme.id === 'graveyard') { g.fillStyle = '#3a5832'; g.fillRect(fx, fy, 1, 2); g.fillRect(fx + 2, fy - 1, 1, 3); }
    else { g.fillStyle = 'rgba(232,224,200,0.25)'; g.fillRect(fx, fy, 2, 1); }
  }
  ellipse(g, W / 2, H + 20, W * 0.8, 40, 'rgba(0,0,0,0.0)');
  return c;
}
