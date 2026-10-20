// Procedural floor generation: rooms + corridors, decor, enemies and loot.
import { RNG } from './rng.js';
import { themeFor, isBossFloor, scaleEnemy, makeWeapon, ENEMIES } from './data.js';

export const MW = 40, MH = 40;
export const WALL = 0, FLOOR = 1;

export function generate(depth, seed) {
  const rng = new RNG(seed);
  const theme = themeFor(depth);
  const boss = isBossFloor(depth);
  const tiles = new Uint8Array(MW * MH);
  const solid = new Uint8Array(MW * MH);
  const idx = (x, y) => y * MW + x;
  const rooms = [];

  const overlaps = (x, y, w, h) => rooms.some(r => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y);
  if (boss) {
    const w = 9, h = 9;
    rooms.push({ x: rng.int(3, MW - w - 4), y: rng.int(3, MH - h - 4), w, h, boss: true });
  }
  const maxRooms = boss ? 6 : Math.min(11, 6 + Math.floor(depth / 2));
  for (let tries = 0; rooms.length < maxRooms && tries < 400; tries++) {
    const w = rng.int(4, 8), h = rng.int(4, 8);
    const x = rng.int(2, MW - w - 3), y = rng.int(2, MH - h - 3);
    if (!overlaps(x, y, w, h)) rooms.push({ x, y, w, h });
  }
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) tiles[idx(x, y)] = FLOOR;

  const ctr = r => [r.x + (r.w >> 1), r.y + (r.h >> 1)];
  const carveCorridor = (a, b) => {
    let [x0, y0] = ctr(a); const [x1, y1] = ctr(b);
    const horizFirst = rng.chance(0.5);
    const hx = () => { while (x0 !== x1) { tiles[idx(x0, y0)] = FLOOR; x0 += Math.sign(x1 - x0); } };
    const vy = () => { while (y0 !== y1) { tiles[idx(x0, y0)] = FLOOR; y0 += Math.sign(y1 - y0); } };
    if (horizFirst) { hx(); vy(); } else { vy(); hx(); }
    tiles[idx(x1, y1)] = FLOOR;
  };
  const dist = (a, b) => { const [ax, ay] = ctr(a), [bx, by] = ctr(b); return Math.abs(ax - bx) + Math.abs(ay - by); };
  const conn = [0], rest = rooms.map((_, i) => i).slice(1);
  while (rest.length) {
    let best = null;
    for (const a of conn) for (const b of rest) {
      const d = dist(rooms[a], rooms[b]);
      if (!best || d < best[2]) best = [a, b, d];
    }
    carveCorridor(rooms[best[0]], rooms[best[1]]);
    conn.push(best[1]); rest.splice(rest.indexOf(best[1]), 1);
  }
  for (let i = 0; i < 2; i++) {
    const a = rng.pick(rooms), b = rng.pick(rooms);
    if (a !== b && dist(a, b) < 18) carveCorridor(a, b);
  }

  const walk = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH && tiles[idx(x, y)] === FLOOR && !solid[idx(x, y)];
  const bfs = (sx, sy) => {
    const d = new Int16Array(MW * MH).fill(-1);
    const q = [idx(sx, sy)]; d[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % MW, y = (i / MW) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (walk(nx, ny) && d[idx(nx, ny)] < 0) { d[idx(nx, ny)] = d[i] + 1; q.push(idx(nx, ny)); }
      }
    }
    return d;
  };

  // Start room: for boss floors pick the room farthest from the arena.
  let startRoom = rooms[boss ? 1 : 0] || rooms[0];
  if (boss) {
    let far = -1;
    for (const r of rooms.slice(1)) { const d = dist(r, rooms[0]); if (d > far) { far = d; startRoom = r; } }
  }
  const [sx, sy] = ctr(startRoom);
  let dmap = bfs(sx, sy);
  let stairsRoom = rooms[0];
  if (!boss) {
    let far = -1;
    for (const r of rooms) { const [x, y] = ctr(r); if (r !== startRoom && dmap[idx(x, y)] > far) { far = dmap[idx(x, y)]; stairsRoom = r; } }
  }
  const [stx, sty] = ctr(stairsRoom);

  // Decor: blocking props only where they keep the floor fully connected.
  const decor = [];
  const floorCount = () => { let n = 0; for (let i = 0; i < MW * MH; i++) if (tiles[i] === FLOOR && !solid[i]) n++; return n; };
  let total = floorCount();
  const reserved = new Set([idx(sx, sy), idx(stx, sty)]);
  for (const r of rooms) {
    const n = r.boss ? 4 : Math.floor((r.w * r.h) / 9);
    for (let k = 0; k < n; k++) {
      const x = rng.int(r.x, r.x + r.w - 1), y = rng.int(r.y, r.y + r.h - 1);
      const i = idx(x, y);
      if (solid[i] || reserved.has(i)) continue;
      if (r.boss && Math.abs(x - stx) < 3 && Math.abs(y - sty) < 3) continue;
      solid[i] = 1;
      const reach = bfs(sx, sy);
      let ok = 0;
      for (let j = 0; j < MW * MH; j++) if (reach[j] >= 0) ok++;
      if (ok !== total - 1) { solid[i] = 0; continue; }
      total--;
      decor.push({ x, y, type: rng.pick(theme.block), block: true });
    }
    const m = Math.floor((r.w * r.h) / 6);
    for (let k = 0; k < m; k++) {
      const x = rng.int(r.x, r.x + r.w - 1), y = rng.int(r.y, r.y + r.h - 1);
      if (!solid[idx(x, y)]) decor.push({ x, y, type: rng.pick(theme.flat), block: false, ox: rng.int(-4, 4), oy: rng.int(-2, 2) });
    }
  }
  dmap = bfs(sx, sy);

  // Entities
  const ents = [];
  let nextId = 1;
  const occupied = new Set([idx(sx, sy), idx(stx, sty)]);
  const freeIn = (r, tries = 30) => {
    for (let t = 0; t < tries; t++) {
      const x = rng.int(r.x, r.x + r.w - 1), y = rng.int(r.y, r.y + r.h - 1);
      const i = idx(x, y);
      if (walk(x, y) && !occupied.has(i) && dmap[i] >= 0) { occupied.add(i); return [x, y]; }
    }
    return null;
  };
  // Static blockers (chests, fountains...) must not seal off any part of the floor.
  const blockers = new Set();
  const reachCount = () => {
    const saved = [];
    for (const i of blockers) { saved.push(i); solid[i] = 1; }
    const r = bfs(sx, sy);
    for (const i of saved) solid[i] = 0;
    let n = 0;
    for (let j = 0; j < MW * MH; j++) if (r[j] >= 0) n++;
    // Every blocker must still be reachable from at least one side.
    for (const i of blockers) if (![1, -1, MW, -MW].some(o => r[i + o] >= 0)) return -1;
    return n;
  };
  let reachable = reachCount();
  const freeBlocking = r => {
    for (let t = 0; t < 8; t++) {
      const pos = freeIn(r);
      if (!pos) return null;
      const i = idx(pos[0], pos[1]);
      blockers.add(i);
      const n = reachCount();
      if (n === reachable - 1) { reachable = n; return pos; }
      blockers.delete(i);
    }
    return null;
  };
  const add = (e, pos) => { if (pos) { e.id = nextId++; e.x = pos[0]; e.y = pos[1]; ents.push(e); } return e; };
  const otherRooms = rooms.filter(r => r !== startRoom && !r.boss);
  const anyRoom = () => rng.pick(otherRooms.length ? otherRooms : rooms);
  const makeEnemy = type => ({ kind: 'enemy', type, ...scaleEnemy(type, depth), awake: false, stun: 0, boss: !!ENEMIES[type].boss });

  if (boss) {
    add(makeEnemy(theme.boss), [stx, sty]);
    occupied.add(idx(stx, sty));
  } else {
    add({ kind: 'stairs' }, [stx, sty]);
  }

  const nEnemies = boss ? 3 + Math.floor(depth / 5) : Math.min(14, 4 + Math.floor(depth * 0.7));
  const pool = theme.enemies.filter(([, minD]) => minD <= depth);
  for (let i = 0; i < nEnemies; i++) {
    const [type] = rng.weighted(pool, p => p[2]);
    const r = anyRoom();
    add(makeEnemy(type), freeIn(r));
  }
  const nChests = rng.int(1, 3);
  for (let i = 0; i < nChests; i++) add({ kind: 'chest', opened: false, mimic: depth >= 3 && rng.chance(0.15) }, freeBlocking(anyRoom()));
  for (let i = rng.int(0, 2); i > 0; i--) add({ kind: 'potion' }, freeIn(anyRoom()));
  for (let i = rng.int(2, 4); i > 0; i--) add({ kind: 'gold', amount: rng.int(3, 8) + depth * 2 }, freeIn(anyRoom()));
  if (rng.chance(0.3)) add({ kind: 'weapon', weapon: makeWeapon(rng, depth) }, freeIn(anyRoom()));
  if (rng.chance(0.35)) add({ kind: 'fountain', used: false }, freeBlocking(anyRoom()));
  if (!boss && (depth % 5 === 3 || (depth > 3 && rng.chance(0.2)))) add({ kind: 'merchant', stock: null }, freeBlocking(anyRoom()));
  if (depth >= 2 && rng.chance(0.3)) add({ kind: 'altar', used: false }, freeBlocking(anyRoom()));

  // Walls that border floor are the only ones worth drawing.
  const edge = new Uint8Array(MW * MH);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (tiles[idx(x, y)] !== WALL) continue;
    for (let dy = -1; dy <= 1 && !edge[idx(x, y)]; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < MW && ny < MH && tiles[idx(nx, ny)] === FLOOR) { edge[idx(x, y)] = 1; break; }
    }
  }

  return { w: MW, h: MH, tiles, solid, edge, decor, ents, start: [sx, sy], stairs: [stx, sty], theme, boss, nextId };
}
