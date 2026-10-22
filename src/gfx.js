// Pixel-art helpers: palette sprites, outlines, silhouettes, crisp primitives.
export const PAL = {
  k: '#140c1c', K: '#2a1d33', w: '#e8e0c8', W: '#b0a68a', l: '#fffbea',
  g: '#a8b4c0', G: '#5c6878', r: '#d04040', R: '#7a1f2a', o: '#e8822c', O: '#9a4418',
  y: '#f0d050', Y: '#a87c28', e: '#7ac040', E: '#3e6e2c', z: '#9cb87a', Z: '#5e7a4a',
  p: '#9a58c0', P: '#502870', c: '#70d0e0', C: '#307088', n: '#8a5a3a', N: '#4e3022',
  s: '#8a8478', S: '#4a463e', m: '#a898b0', M: '#6a5a78', b: '#4060b0', B: '#202a60', x: '#000000',
};

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w); c.height = Math.max(1, h);
  return c;
}

export function hexRgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

// Build a sprite from rows of palette characters with a 1px auto outline.
export function sprite(rows, outline = PAL.k) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = makeCanvas(w + 2, h + 2);
  const x = c.getContext('2d');
  rows.forEach((r, y) => {
    for (let i = 0; i < r.length; i++) {
      const col = PAL[r[i]];
      if (!col) continue;
      x.fillStyle = col; x.fillRect(i + 1, y + 1, 1, 1);
    }
  });
  if (outline) addOutline(c, outline);
  return c;
}

export function addOutline(c, col) {
  const x = c.getContext('2d');
  const W = c.width, H = c.height;
  const d = x.getImageData(0, 0, W, H);
  const a = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) a[i] = d.data[i * 4 + 3] > 0 ? 1 : 0;
  const [r, gg, b] = hexRgb(col);
  for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) {
    const k = y * W + i;
    if (a[k]) continue;
    if ((i > 0 && a[k - 1]) || (i < W - 1 && a[k + 1]) || (y > 0 && a[k - W]) || (y < H - 1 && a[k + W])) {
      d.data[k * 4] = r; d.data[k * 4 + 1] = gg; d.data[k * 4 + 2] = b; d.data[k * 4 + 3] = 255;
    }
  }
  x.putImageData(d, 0, 0);
}

export function flipH(c) {
  const o = makeCanvas(c.width, c.height);
  const x = o.getContext('2d');
  x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0);
  return o;
}

const silCache = new WeakMap();
export function silhouette(c, col = '#ffffff') {
  let m = silCache.get(c);
  if (!m) { m = {}; silCache.set(c, m); }
  if (m[col]) return m[col];
  const o = makeCanvas(c.width, c.height);
  const x = o.getContext('2d');
  x.drawImage(c, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = col; x.fillRect(0, 0, o.width, o.height);
  m[col] = o;
  return o;
}

const dimCache = new WeakMap();
export function dimmed(c) {
  let o = dimCache.get(c);
  if (o) return o;
  o = makeCanvas(c.width, c.height);
  const x = o.getContext('2d');
  x.drawImage(c, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = 'rgba(10,6,22,0.62)'; x.fillRect(0, 0, o.width, o.height);
  dimCache.set(c, o);
  return o;
}

const pixCache = new WeakMap();
export function pixelsOf(c) {
  let p = pixCache.get(c);
  if (p) return p;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  p = [];
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4;
    if (d[i + 3] > 0) p.push({ x, y, col: `rgb(${d[i]},${d[i + 1]},${d[i + 2]})` });
  }
  pixCache.set(c, p);
  return p;
}

export function rect(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }

export function disc(g, cx, cy, r, col) {
  g.fillStyle = col; cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy) + 0.35);
    g.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
  }
}

export function ring(g, cx, cy, r, col, th = 1) {
  g.fillStyle = col; cx = Math.round(cx); cy = Math.round(cy);
  for (let t = 0; t < th; t++) {
    const rr = Math.round(r) - t;
    if (rr < 0) break;
    let x = rr, y = 0, err = 1 - rr;
    while (x >= y) {
      g.fillRect(cx + x, cy + y, 1, 1); g.fillRect(cx + y, cy + x, 1, 1);
      g.fillRect(cx - y, cy + x, 1, 1); g.fillRect(cx - x, cy + y, 1, 1);
      g.fillRect(cx - x, cy - y, 1, 1); g.fillRect(cx - y, cy - x, 1, 1);
      g.fillRect(cx + y, cy - x, 1, 1); g.fillRect(cx + x, cy - y, 1, 1);
      y++;
      if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
    }
  }
}

export function ellipse(g, cx, cy, rx, ry, col) {
  g.fillStyle = col; cx = Math.round(cx); cy = Math.round(cy);
  ry = Math.max(1, Math.round(ry));
  for (let dy = -ry; dy <= ry; dy++) {
    const dx = Math.round(rx * Math.sqrt(1 - (dy * dy) / (ry * ry)));
    g.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
  }
}

export function line(g, x0, y0, x1, y1, col, size = 1) {
  g.fillStyle = col;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, n = 0;
  const off = Math.floor(size / 2);
  while (n++ < 2000) {
    g.fillRect(x0 - off, y0 - off, size, size);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = t => 1 - (1 - t) * (1 - t);
