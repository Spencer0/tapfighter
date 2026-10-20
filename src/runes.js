// Runes: single-stroke glyphs the player traces in battle, plus a tiny template matcher.
// Glyph points live in a unit box (0..1, y down). Closed glyphs may be traced from any corner.
// The set is chosen so no glyph passes for another (circles and squares read as triangles).
import { disc, ring, line } from './gfx.js';

export const RUNES = {
  vee: { name: 'Vee', pts: [[0.05, 0.05], [0.5, 0.95], [0.95, 0.05]] },
  tri: { name: 'Triangle', pts: [[0.5, 0.03], [0.97, 0.92], [0.03, 0.92], [0.5, 0.03]], closed: true },
  hook: { name: 'Hook', pts: [[0.1, 0.0], [0.1, 1.0], [0.9, 1.0]] },
  zig: { name: 'Zed', pts: [[0.08, 0.08], [0.92, 0.08], [0.08, 0.92], [0.92, 0.92]] },
  bolt: { name: 'Bolt', pts: [[0.7, 0.0], [0.2, 0.55], [0.8, 0.45], [0.3, 1.0]] },
  crown: { name: 'Crown', pts: [[0.0, 0.1], [0.22, 0.9], [0.5, 0.3], [0.78, 0.9], [1.0, 0.1]] },
  bowtie: { name: 'Hourglass', pts: [[0.05, 0.05], [0.95, 0.95], [0.95, 0.05], [0.05, 0.95], [0.05, 0.05]], closed: true },
};

const N = 32;
export const RUNE_PASS = 0.16; // mean normalized distance to count as traced
export const RUNE_PERFECT = 0.085;

function pathLen(p) {
  let d = 0;
  for (let i = 1; i < p.length; i++) d += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return d;
}

// Evenly respace a polyline to n points along its length.
export function resample(pts, n = N) {
  const total = pathLen(pts);
  if (total === 0) return Array.from({ length: n }, () => [pts[0][0], pts[0][1]]);
  const step = total / (n - 1);
  const out = [[pts[0][0], pts[0][1]]];
  let acc = 0;
  let prev = pts[0];
  for (let i = 1; i < pts.length; i++) {
    let cur = pts[i];
    let d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    while (acc + d >= step && d > 0) {
      const k = (step - acc) / d;
      const q = [prev[0] + (cur[0] - prev[0]) * k, prev[1] + (cur[1] - prev[1]) * k];
      out.push(q);
      prev = q; d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]); acc = 0;
    }
    acc += d; prev = cur;
  }
  while (out.length < n) out.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
  return out.slice(0, n);
}

// Center on the centroid and scale so the larger bounding-box side is 1 (keeps aspect ratio).
function normalize(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, cx = 0, cy = 0;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    cx += x; cy += y;
  }
  cx /= pts.length; cy /= pts.length;
  const s = Math.max(maxX - minX, maxY - minY) || 1;
  return pts.map(([x, y]) => [(x - cx) / s, (y - cy) / s]);
}

const meanDist = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d += Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]); return d / a.length; };

const tplCache = new Map();
function templates(id) {
  if (tplCache.has(id)) return tplCache.get(id);
  const r = RUNES[id];
  const out = [];
  if (r.closed) {
    // A closed loop can start anywhere and run either way: try every rotation.
    const loop = resample(r.pts, N + 1).slice(0, N);
    for (const dir of [loop, loop.slice().reverse()]) {
      for (let k = 0; k < N; k++) {
        const rot = dir.slice(k).concat(dir.slice(0, k));
        rot.push(rot[0]);
        out.push(normalize(resample(rot, N)));
      }
    }
  } else {
    const fwd = resample(r.pts, N);
    out.push(normalize(fwd), normalize(fwd.slice().reverse()));
  }
  tplCache.set(id, out);
  return out;
}

// Mean normalized distance between a drawn stroke and a rune (lower is better), or Infinity
// when the stroke is too small to judge. minSize is in the stroke's own units.
export function runeDistance(stroke, id, minSize = 0) {
  if (!stroke || stroke.length < 4) return Infinity;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of stroke) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  if (Math.max(maxX - minX, maxY - minY) < minSize) return Infinity;
  const s = normalize(resample(stroke, N));
  let best = Infinity;
  for (const t of templates(id)) best = Math.min(best, meanDist(s, t));
  return best;
}

export function gradeRune(stroke, id, minSize = 0) {
  const d = runeDistance(stroke, id, minSize);
  return d <= RUNE_PERFECT ? 'perfect' : d <= RUNE_PASS ? 'good' : 'fail';
}

// Draw a rune glyph centered at (cx, cy). progress 0..1 fills the guide from the start point.
export function drawRune(g, id, cx, cy, size, col, o = {}) {
  const r = RUNES[id];
  const P = r.pts.map(([x, y]) => [Math.round(cx + (x - 0.5) * size), Math.round(cy + (y - 0.5) * size)]);
  const th = o.thick || 3;
  if (o.shadow) for (let i = 1; i < P.length; i++) line(g, P[i - 1][0] + 1, P[i - 1][1] + 1, P[i][0] + 1, P[i][1] + 1, o.shadow, th + 2);
  for (let i = 1; i < P.length; i++) line(g, P[i - 1][0], P[i - 1][1], P[i][0], P[i][1], col, th);
  if (o.start) {
    // Start marker plus a short arrow along the first segment.
    const [sx, sy] = P[0], [nx, ny] = P[1];
    const len = Math.hypot(nx - sx, ny - sy) || 1;
    const ux = (nx - sx) / len, uy = (ny - sy) / len;
    const pulse = o.pulse ? 1 : 0;
    disc(g, sx, sy, 4 + pulse, o.start);
    ring(g, sx, sy, 5 + pulse, '#140c1c');
    const ax = sx + ux * 13, ay = sy + uy * 13;
    line(g, sx + ux * 7, sy + uy * 7, ax, ay, o.start, 2);
    line(g, ax, ay, ax - ux * 4 - uy * 3, ay - uy * 4 + ux * 3, o.start, 2);
    line(g, ax, ay, ax - ux * 4 + uy * 3, ay - uy * 4 - ux * 3, o.start, 2);
  }
}
