// Tiny 3x5 bitmap font (variable width) rendered from cached glyph canvases.
const F = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'], D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'], J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'], N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'], P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'], 3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '##.'],
  '.': ['.', '.', '.', '.', '#'], ',': ['.', '.', '.', '#', '#'],
  '!': ['#', '#', '#', '.', '#'], '?': ['##.', '..#', '.#.', '...', '.#.'],
  ':': ['.', '#', '.', '#', '.'], '-': ['...', '...', '###', '...', '...'],
  '+': ['...', '.#.', '###', '.#.', '...'], '/': ['..#', '..#', '.#.', '#..', '#..'],
  "'": ['#', '#', '.', '.', '.'], '%': ['#.#', '..#', '.#.', '#..', '#.#'],
  '(': ['.#', '#.', '#.', '#.', '.#'], ')': ['#.', '.#', '.#', '.#', '#.'],
  '>': ['#..', '.#.', '..#', '.#.', '#..'], '<': ['..#', '.#.', '#..', '.#.', '..#'],
  '=': ['...', '###', '...', '###', '...'], '*': ['...', '#.#', '.#.', '#.#', '...'],
  '"': ['#.#', '#.#', '...', '...', '...'],
};

const cache = new Map();
function glyph(ch, color) {
  let m = cache.get(color);
  if (!m) { m = new Map(); cache.set(color, m); }
  let c = m.get(ch);
  if (c) return c;
  const rows = F[ch] || F['?'];
  c = document.createElement('canvas');
  c.width = rows[0].length; c.height = 5;
  const x = c.getContext('2d');
  x.fillStyle = color;
  rows.forEach((r, y) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') x.fillRect(i, y, 1, 1); });
  m.set(ch, c);
  return c;
}

export function textWidth(s, scale = 1) {
  s = String(s).toUpperCase();
  let w = 0;
  for (const ch of s) w += (ch === ' ' ? 2 : (F[ch] || F['?'])[0].length) + 1;
  return Math.max(0, w - 1) * scale;
}

function raw(g, s, x, y, color, scale) {
  for (const ch of s) {
    if (ch === ' ') { x += 3 * scale; continue; }
    const c = glyph(ch, color);
    g.drawImage(c, x, y, c.width * scale, c.height * scale);
    x += (c.width + 1) * scale;
  }
}

// opts: scale, align ('left'|'center'|'right'), outline color, shadow color
export function text(g, s, x, y, color = '#e8e0c8', o = {}) {
  const scale = o.scale || 1;
  s = String(s).toUpperCase();
  const w = textWidth(s, scale);
  if (o.align === 'center') x -= Math.floor(w / 2);
  else if (o.align === 'right') x -= w;
  x = Math.round(x); y = Math.round(y);
  if (o.outline) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) raw(g, s, x + dx * scale, y + dy * scale, o.outline, scale);
  } else if (o.shadow) {
    raw(g, s, x + scale, y + scale, o.shadow, scale);
  }
  raw(g, s, x, y, color, scale);
  return w;
}

// Greedy word wrap to a pixel width.
export function wrap(s, maxW, scale = 1) {
  const words = String(s).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (textWidth(t, scale) > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
