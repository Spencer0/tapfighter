// Page-side promo bot. Loaded into the running game by capture.mjs.
// It sets up a scene, plays it through the game's real input path (synthetic pointer events on the
// canvas), and hands back pixel-exact frames from the game's low-res buffer.
window.TFPromo = (() => {
  const M = {};
  const log = [];                 // sound-cue log: { t, text } in video seconds
  let vt = 0;                     // video time (s) of the next captured frame
  let cur = null;                 // current scene { bot, state }
  const FRAME = 1000 / 60;

  async function load() {
    for (const n of ['engine', 'combat', 'explore', 'data', 'rng', 'state', 'title', 'sprites']) M[n] = await import(`/src/${n}.js`);
    const pop = M.combat.Combat.prototype.pop;
    M.combat.Combat.prototype.pop = function (t, ...rest) { if (cur?.capturing) log.push({ t: +vt.toFixed(3), text: t }); return pop.call(this, t, ...rest); };
  }

  // ---- input -------------------------------------------------------------------------------
  const canvas = () => document.getElementById('game');
  function client(x, y) {
    const r = canvas().getBoundingClientRect(), G = M.engine.G;
    return { clientX: r.left + (x / G.W) * r.width, clientY: r.top + (y / G.H) * r.height };
  }
  let pid = 10;
  function fire(type, x, y, id) {
    canvas().dispatchEvent(new PointerEvent(type, { pointerId: id, bubbles: true, cancelable: true, isPrimary: true, ...client(x, y) }));
  }
  const tap = (x, y) => { const id = pid++; fire('pointerdown', x, y, id); fire('pointerup', x, y, id); };
  // Queue a drag: points are played back one per frame so the stroke has real duration.
  const drags = [];
  function drag(pts) { const id = pid++; drags.push({ id, pts: pts.slice(), i: 0 }); }
  function pumpDrags() {
    for (const d of drags) {
      const [x, y] = d.pts[Math.min(d.i, d.pts.length - 1)];
      if (d.i === 0) fire('pointerdown', x, y, d.id);
      else if (d.i < d.pts.length) fire('pointermove', x, y, d.id);
      else { fire('pointerup', x, y, d.id); d.done = true; }
      d.i++;
    }
    for (let i = drags.length - 1; i >= 0; i--) if (drags[i].done) drags.splice(i, 1);
  }

  // ---- helpers -----------------------------------------------------------------------------
  function makeRun(o) {
    const { rand } = M.rng, { makeWeapon } = M.data;
    return {
      seed: 1234, depth: 1, hp: 50, maxHp: 50, level: 1, xp: 0, levelUps: 0, gold: 0, potions: 2,
      weapons: [makeWeapon(rand, 1, 'sword', 0), makeWeapon(rand, 1, 'dagger', 0)], equipped: 0,
      bless: {}, kills: 0, steps: 0, bestCombo: 0, won: false, startedAt: Date.now(), ...o,
    };
  }
  function startCombat(run, ent, explore) {
    const c = new M.combat.Combat(run, ent, explore);
    explore.inCombat = true;
    M.engine.setScene(c, null);
    return c;
  }

  // ---- scenes ------------------------------------------------------------------------------
  const scenes = {
    // 1) The final boss kills you.
    async boss() {
      const { rand } = M.rng, { makeWeapon } = M.data;
      const run = makeRun({
        depth: 15, level: 14, hp: 34, maxHp: 110, kills: 61, gold: 912,
        weapons: [makeWeapon(rand, 14, 'sword', 3), makeWeapon(rand, 14, 'dagger', 2)],
        bless: { steady: 1, keen: 1, brutal: 1 },
      });
      const ex = new M.explore.Explore(run);
      const ent = ex.ents.find(e => e.boss);
      const c = startCombat(run, ent, ex);
      return { c, skip: 0.9, bot(c, st) {
        if (c.phase === 'fight' && !st.rushed) { st.rushed = true; c.foeNext = c.clock; }
        for (const m of c.marks) {
          if (m.kind === 'strike' && !m.done && c.clock >= m.hitT - 8) { const p = c.markPos(m, c.clock); tap(p.x, p.y); }
        }
      } };
    },

    // 2) Fumbling a rune.
    async rune() {
      const run = makeRun({ depth: 12, level: 10, hp: 70, maxHp: 90, bless: { steady: 1 } });
      const ex = new M.explore.Explore(run);
      const ent = { kind: 'enemy', type: 'witch', ...M.data.scaleEnemy('witch', 12), awake: true, stun: 0, id: 9999, x: 1, y: 1 };
      const c = startCombat(run, ent, ex);
      return { c, skip: 0.75, async setup() { window.__RUNES = (await import('/src/runes.js')).RUNES; }, bot(c, st) {
        const R = window.__RUNES;
        if (!st.armed) {
          st.armed = true;
          c.pendingAtk = M.data.ENEMIES.witch.attacks.find(a => a.name === 'Witch Mark');
        }
        const m = c.marks.find(x => x.kind === 'rune' && !x.done);
        if (m && !st.shortened) { st.shortened = true; m.hitT = m.spawnT + 1500; m.lead = 1500; st.spawn = m.spawnT; m.rune = 'bowtie'; }
        if (m && st.spawn !== undefined) {
          const dt = (c.clock - st.spawn) / 1000, size = m.size;
          const at = (x, y) => [m.x + (x - 0.5) * size, m.y + (y - 0.5) * size];
          const through = (pts, per = 5, wob = 0) => {
            const out = [];
            for (let i = 1; i < pts.length; i++) for (let k = 0; k < per; k++) {
              const a = pts[i - 1], b = pts[i], f = k / per;
              out.push(at(a[0] + (b[0] - a[0]) * f + (Math.random() - 0.5) * wob, a[1] + (b[1] - a[1]) * f + (Math.random() - 0.5) * wob));
            }
            return out;
          };
          if (dt > 0.30 && !st.try1) { st.try1 = true; drag(through([[0.05, 0.05], [0.95, 0.95], [0.6, 0.05], [0.2, 0.7], [0.4, 0.3]], 4, 0.1)); }
          if (dt > 0.85 && !st.try2) { st.try2 = true; drag(through([[0.1, 0.1], [0.1, 0.9], [0.9, 0.9]], 6, 0.05)); }
        }
        pumpDrags();
      } };
    },

    // 3) Three crits, dead mob.
    async crits() {
      const { rand } = M.rng, { makeWeapon } = M.data;
      const run = makeRun({
        depth: 8, level: 9, hp: 85, maxHp: 100, bless: { steady: 1, combo: 1 },
        weapons: [makeWeapon(rand, 8, 'sword', 2), makeWeapon(rand, 8, 'dagger', 1)],
      });
      run.weapons[0].affixes = ['brutal', 'flaming'];
      const ex = new M.explore.Explore(run);
      const ent = { kind: 'enemy', type: 'skeleton', ...M.data.scaleEnemy('skeleton', 8), awake: true, stun: 0, id: 9998, x: 1, y: 1 };
      const c = startCombat(run, ent, ex);
      c.tempo = 1.5;
      return { c, skip: 0.6, bot(c, st) {
        const s = M.data.weaponStats(run.weapons[0], run);
        if (!st.sized) {
          st.sized = true;
          // size the mob so the third crit is the killing blow
          let total = 0;
          for (let i = 0; i < 3; i++) {
            const cm = 1 + Math.min(1, (i + 1) * 0.06 * (1 + 0.5 * (run.bless.combo || 0)));
            total += Math.max(1, Math.round(s.dmg * 1.5 * 1.4 * cm - c.foe.armor));
          }
          c.foe.maxHp = c.foe.ghost = c.foe.hp = total - 2;
        }
        if (c.volley && !st.fixed) {
          st.fixed = true;
          const r = c.foeRect();
          const hx = r.x + c.def.head[0] * r.w, hy = r.y + c.def.head[1] * r.h;
          const offs = [[-14, 8], [12, -2], [-2, -16]];
          c.volley.marks.forEach((m, i) => { m.crit = true; m.x = hx + offs[i][0]; m.y = hy + offs[i][1]; });
        }
        for (const m of c.marks) {
          if (m.kind === 'strike' && !m.done && c.clock >= m.hitT - 8) { const p = c.markPos(m, c.clock); tap(p.x, p.y); }
        }
      } };
    },
  };


  // 4) Run the map, grab epic loot.
  scenes.loot = async function () {
    const { rand } = M.rng, { makeWeapon } = M.data;
    const run = makeRun({ depth: 4, level: 7, hp: 66, maxHp: 70, gold: 140, weapons: [makeWeapon(rand, 4, 'sword', 1)], bless: { steady: 1 } });
    const ex = new M.explore.Explore(run);
    ex.ents = ex.ents.filter(e => e.kind === 'stairs');
    ex.banner = null;
    // Breadth-first route from the start to a tile LEN steps away.
    const LEN = 22, p0 = ex.player, key = (x, y) => y * 64 + x;
    const prev = new Map([[key(p0.x, p0.y), null]]), dist = new Map([[key(p0.x, p0.y), 0]]);
    const q = [[p0.x, p0.y]];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    const ends = [];
    while (q.length) {
      const [x, y] = q.shift(), d = dist.get(key(x, y));
      if (d === LEN) { ends.push([x, y]); continue; }
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (!ex.passable(nx, ny) || prev.has(key(nx, ny)) || !ex.canStep(x, y, nx, ny)) continue;
        prev.set(key(nx, ny), [x, y]); dist.set(key(nx, ny), d + 1); q.push([nx, ny]);
      }
    }
    // Prefer the route through the roomiest ground.
    const trace = end => { const p = []; for (let c = end; c && key(...c) !== key(p0.x, p0.y); c = prev.get(key(...c))) p.unshift(c); return p; };
    const open = p => p.reduce((a, [x, y]) => a + dirs.filter(([dx, dy]) => ex.passable(x + dx, y + dy)).length, 0);
    const path = ends.map(trace).sort((a, b) => open(b) - open(a))[0];
    for (const [x, y] of path) for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) if (ex.inb(x + dx, y + dy)) ex.explored[ex.idx(x + dx, y + dy)] = 1;
    const put = (i, e) => { const [x, y] = path[i]; ex.ents.push({ id: 7000 + i, x, y, rx: x, ry: y, ...e }); };
    put(3, { kind: 'gold', amount: 14 });
    put(8, { kind: 'weapon', weapon: makeWeapon(rand, 6, 'axe', 2) });
    put(12, { kind: 'potion' });
    put(16, { kind: 'weapon', weapon: makeWeapon(rand, 9, 'crossbow', 3) });
    put(20, { kind: 'gold', amount: 40 });
    ex.computeFov();
    M.engine.setScene(ex, null);
    const legs = [path.slice(0, 9), path.slice(9, 17), path.slice(17)];
    return { c: ex, skip: 0, bot(ex, st) {
      st.leg ??= 0; st.wait ??= 0;
      if (ex.modal) {
        if (++st.wait === 24) {
          const G = M.engine.G, hits = G.hits.slice(Math.max(0, G.modalIndex)).sort((a, b) => b.x - a.x);   // TAKE is the right-most button
          const h = hits[0]; tap(h.x + h.w / 2, h.y + h.h / 2);
        }
        return;
      }
      st.wait = 0;
      if (!ex.player.path.length && ex.player.t >= 1 && st.leg < legs.length && !st.busy) {
        const leg = legs[st.leg++];
        ex.player.path = leg.slice(); ex.target = leg[leg.length - 1];
        const [sx, sy] = ex.screenOf(...ex.target); ex.tapFx(...ex.target, '#fffbea');
      }
    } };
  };


  // Trace a rune's glyph through the game's own template points (pts in unit box).
  async function glyph(m, wob = 0.02, per = 6) {
    const R = (await import('/src/runes.js')).RUNES[m.rune].pts, out = [];
    for (let i = 1; i < R.length; i++) for (let k = 0; k < per; k++) {
      const a = R[i - 1], b = R[i], f = k / per;
      out.push([m.x + (a[0] + (b[0] - a[0]) * f - 0.5 + (Math.random() - 0.5) * wob) * m.size, m.y + (a[1] + (b[1] - a[1]) * f - 0.5 + (Math.random() - 0.5) * wob) * m.size]);
    }
    return out;
  }

  // 5) First boss (Pumpkin King): a clean fight, then the rhythm encore takes you down.
  scenes.pumpkin = async function () {
    const { rand } = M.rng, { makeWeapon } = M.data;
    const run = makeRun({
      depth: 5, level: 6, hp: 30, maxHp: 80, kills: 14, gold: 210, bless: { steady: 1, keen: 1 },
      weapons: [makeWeapon(rand, 5, 'sword', 2), makeWeapon(rand, 5, 'dagger', 1)],
    });
    const ex = new M.explore.Explore(run);
    const ent = ex.ents.find(e => e.boss);
    const c = startCombat(run, ent, ex);
    c.foe.hp = c.foe.ghost = Math.round(c.foe.maxHp * 0.5) + (window.__PK_OVER ?? 70);
    return { c, skip: 0.9, bot(c, st) {
      st.n ??= 0;
      const G = M.engine.G;
      if (c.phase === 'fight') {
        for (const m of c.marks) {
          if (m.done) continue;
          if ((m.kind === 'strike' || m.kind === 'guard') && c.clock >= m.hitT - 8) { const p = c.markPos(m, c.clock); tap(p.x, p.y); }
          else if (m.kind === 'orb' && c.clock >= m.hitT - 260) { const p = c.markPos(m, c.clock); tap(p.x, p.y); }
        }
      }
      if (c.phase === 'rhythm') {
        const sg = c.song;
        if (!st.rh) {
          st.rh = true;
          const cut = window.__PK_CUT ?? 1300;               // shorten the count-in
          sg.start -= cut; sg.end -= cut; sg.notes.forEach(n => { n.t -= cut; });
          c.foe.dmg = Math.round(c.foe.dmg * (window.__PK_DMGX ?? 3));     // bard-tier misses sting
        }
        const { hitY, lw } = c.rhythmGeom();
        const keep = window.__PK_KEEP ?? 5;                  // how many notes you hit before it falls apart
        sg.notes.forEach((n, i) => {
          if (n.done || st.tapped?.has(n)) return;
          if (c.clock >= n.t - 8) {
            (st.tapped ??= new Set()).add(n);
            const idx = (st.idx = (st.idx || 0) + 1);
            if (idx <= keep || idx % 4 === 0) tap((n.lane + 0.5) * lw, hitY);
          }
        });
      }
    } };
  };

  // 6) Walk the map and shop with the merchant.
  scenes.shop = async function () {
    const { rand } = M.rng, { makeWeapon } = M.data;
    const run = makeRun({ depth: 3, level: 5, hp: 55, maxHp: 60, gold: 320, weapons: [makeWeapon(rand, 3, 'sword', 1), makeWeapon(rand, 3, 'dagger', 0)], bless: { steady: 1 } });
    const ex = new M.explore.Explore(run);
    ex.ents = ex.ents.filter(e => e.kind === 'stairs');
    ex.banner = null;
    const LEN = +(window.__SHOP_LEN ?? 9), p0 = ex.player, key = (x, y) => y * 64 + x;
    const prev = new Map([[key(p0.x, p0.y), null]]), dist = new Map([[key(p0.x, p0.y), 0]]);
    const q = [[p0.x, p0.y]], ends = [];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (q.length) {
      const [x, y] = q.shift(), d = dist.get(key(x, y));
      if (d === LEN) { ends.push([x, y]); continue; }
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (!ex.passable(nx, ny) || prev.has(key(nx, ny)) || !ex.canStep(x, y, nx, ny)) continue;
        prev.set(key(nx, ny), [x, y]); dist.set(key(nx, ny), d + 1); q.push([nx, ny]);
      }
    }
    const trace = end => { const p = []; for (let c = end; c && key(...c) !== key(p0.x, p0.y); c = prev.get(key(...c))) p.unshift(c); return p; };
    const open = p => p.reduce((a, [x, y]) => a + dirs.filter(([dx, dy]) => ex.passable(x + dx, y + dy)).length, 0);
    const path = ends.map(trace).sort((a, b) => open(b) - open(a))[0];
    for (const [x, y] of path) for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) if (ex.inb(x + dx, y + dy)) ex.explored[ex.idx(x + dx, y + dy)] = 1;
    const put = (i, e) => { const [x, y] = path[i]; ex.ents.push({ id: 7100 + i, x, y, rx: x, ry: y, ...e }); };
    put(3, { kind: 'gold', amount: 12 });
    put(LEN - 1, { kind: 'merchant', stock: null });
    ex.computeFov();
    M.engine.setScene(ex, null);
    return { c: ex, skip: 0, bot(ex, st) {
      const G = M.engine.G;
      if (!st.go) { st.go = true; ex.player.path = path.slice(); ex.target = path[path.length - 1]; ex.tapFx(...ex.target, '#fffbea'); }
      if (ex.modal) {
        st.w = (st.w || 0) + 1;
        const hits = G.hits.slice(Math.max(0, G.modalIndex));
        if (ex.modal.title === 'MERCHANT' && st.w === (window.__SHOP_BUY ?? 40) && !st.bought) { st.bought = true; const h = hits[2]; tap(h.x + h.w / 2, h.y + h.h / 2); st.w = 0; }
        else if (ex.modal.title === 'NEW WEAPON' && st.w === 26) { const h = hits.slice().sort((a, b) => b.x - a.x)[0]; tap(h.x + h.w / 2, h.y + h.h / 2); st.w = 0; }
      }
    } };
  };

  return {
    load,
    async setup(name) {
      cur = await scenes[name]();
      cur.state = {}; cur.capturing = false;
      if (cur.setup) await cur.setup();
      cur.name = name;
      return true;
    },
    // Advance one 60fps frame; the bot acts first, like a player reacting to the last frame.
    step() {
      cur.bot(cur.c, cur.state);
      window.__adv(FRAME);
    },
    advance(n) { for (let i = 0; i < n; i++) this.step(); },
    // Skip ahead (not recorded) until the scene's own clock reaches t seconds.
    skipTo(t) { let n = 0; while (cur.c.clock / 1000 < t && n++ < 3000) this.step(); },
    frame() {
      cur.capturing = true;
      const t0 = +vt.toFixed(3);
      this.step();
      const c = cur.c;
      if (c.phase !== cur.lastPh) { if (c.phase === 'defeat' || c.phase === 'victory' || c.phase === 'rhythm') log.push({ t: t0, text: c.phase.toUpperCase() }); cur.lastPh = c.phase; }
      if (cur.name === 'shop') {
        const r = c.run, k = `${r.gold}|${r.weapons.length}`;
        if (cur.lastK && k !== cur.lastK) log.push({ t: t0, text: r.weapons.length !== +cur.lastK.split('|')[1] ? 'LOOT' : 'BUY' });
        cur.lastK = k;
        if (c.modal && !cur.modalSeen) { cur.modalSeen = true; log.push({ t: t0, text: 'DIALOG' }); }
        if (!c.modal) cur.modalSeen = false;
        if (r.gold !== cur.lastG && cur.lastG !== undefined) log.push({ t: t0, text: 'BUY' });
        cur.lastG = r.gold;
      }
      if (cur.name === 'loot') {
        const r = c.run, k = `${r.gold}|${r.potions}|${r.weapons.length}`;
        if (cur.lastK && k !== cur.lastK) log.push({ t: t0, text: r.weapons.length !== +cur.lastK.split('|')[2] ? 'LOOT' : 'COIN' });
        cur.lastK = k;
        if (c.modal && !cur.modalSeen) { cur.modalSeen = true; log.push({ t: t0, text: 'DIALOG' }); }
        if (!c.modal) cur.modalSeen = false;
      }
      const png = M.engine.buf.toDataURL('image/png');
      vt += 1 / 60;
      return png;
    },
    info() { const c = cur.c; return { clock: c.clock, phase: c.phase, hp: M.engine.G.scene?.run?.hp, foe: c.foe && c.foe.hp, err: window.__tfError || null }; },
    setVT(t) { vt = t; },
    getLog() { return log; },
    skipSecs() { return cur.skip; },
    state() { return cur; },
  };
})();
