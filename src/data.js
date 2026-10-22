// Game content: themes, weapons, affixes, enemies, blessings and formulas.

export const THEMES = [
  {
    id: 'graveyard', name: 'Boneyard',
    floor: ['#34502e', '#3a5832', '#2f4a2a', '#365330'], floorHi: '#4c6e3e', floorLo: '#22361f',
    wallTop: '#727a6c', wallL: '#2e3234', wallR: '#464c4c', mortar: '#202426', moss: '#4a6a3a',
    sky: ['#0b0818', '#1c1638', '#33285a', '#4a3a6a'], ground: '#22341e', groundLine: '#2e4428',
    block: ['grave', 'grave', 'cross', 'tree', 'grave'], flat: ['bones', 'skull', 'tuft', 'tuft', 'tuft', 'pumpkinlamp'],
    enemies: [['zombie', 1, 5], ['skeleton', 1, 4], ['bat', 1, 3], ['imp', 2, 2], ['pumpkin', 3, 2], ['bard', 3, 1]],
    boss: 'pumpkinKing', mote: '#c8e0a0',
  },
  {
    id: 'crypt', name: 'Crypts',
    floor: ['#4a4248', '#504850', '#443c44', '#4c444a'], floorHi: '#625a62', floorLo: '#2e282e',
    wallTop: '#7e6e5e', wallL: '#2e2420', wallR: '#4a3a30', mortar: '#1e1814', moss: '#5a4a3a',
    sky: ['#08060c', '#14101a', '#201a28', '#2c2234'], ground: '#2a242a', groundLine: '#3a323a',
    block: ['coffin', 'pillar', 'urn', 'coffin'], flat: ['bones', 'skull', 'crack', 'crack', 'bones'],
    enemies: [['skeleton', 1, 4], ['ghoul', 1, 4], ['bat', 1, 2], ['zombie', 1, 2], ['wraith', 7, 3], ['pumpkin', 6, 1], ['bard', 1, 2]],
    boss: 'colossus', mote: '#e0c890',
  },
  {
    id: 'cathedral', name: 'Cursed Cathedral',
    floor: ['#5a4a6a', '#2c2434', '#5a4a6a', '#2c2434'], floorHi: '#7a6a8a', floorLo: '#1c1424',
    wallTop: '#8a7a9a', wallL: '#2a2238', wallR: '#40345a', mortar: '#1a1426', moss: '#6a5a7a',
    sky: ['#0a0612', '#1a0e26', '#2a1440', '#3a1e54'], ground: '#241c2e', groundLine: '#3a2e48',
    block: ['pillar', 'statue', 'pillar', 'urn'], flat: ['skull', 'crack', 'bones'],
    enemies: [['gargoyle', 1, 4], ['witch', 1, 4], ['wraith', 1, 3], ['imp', 1, 2], ['ghoul', 1, 2], ['pumpkin', 1, 1], ['banshee', 1, 2]],
    boss: 'lich', mote: '#d0a0f0', checker: true,
  },
];
export const themeFor = depth => THEMES[Math.floor((depth - 1) / 5) % THEMES.length];
export const isBossFloor = depth => depth % 5 === 0;
export const FINAL_DEPTH = 15;

export const RARITY = [
  { name: 'Common', color: '#c8c0b0' },
  { name: 'Rare', color: '#5ab0f0' },
  { name: 'Epic', color: '#c070f0' },
  { name: 'Legendary', color: '#f0b030' },
];

// lead: ms for the ring to close. gap: ms between strikes. perfect/good: +/- ms windows.
export const WEAPONS = {
  sword: { name: 'Short Sword', dmg: 8, strikes: 3, lead: 780, gap: 430, perfect: 85, good: 170, minD: 1, desc: 'Reliable. Three clean strikes.' },
  dagger: { name: 'Dagger', dmg: 4, strikes: 5, lead: 640, gap: 260, perfect: 80, good: 160, minD: 1, desc: 'Five rapid stabs. Builds combos.' },
  drumstick: { name: 'Chicken Leg', dmg: 3, strikes: 3, lead: 700, gap: 400, perfect: 110, good: 220, heal: 2, minD: 1, desc: 'Tasty. Every hit heals you.' },
  club: { name: 'Spiked Club', dmg: 13, strikes: 2, lead: 860, gap: 620, perfect: 90, good: 180, stun: 0.35, minD: 1, desc: 'Perfect hits may stun.' },
  spear: { name: 'Spear', dmg: 9, strikes: 3, lead: 720, gap: 360, perfect: 80, good: 160, pierce: true, minD: 2, desc: 'Ignores armor.' },
  broad: { name: 'Broadsword', dmg: 12, strikes: 3, lead: 820, gap: 500, perfect: 75, good: 155, minD: 3, desc: 'Heavy blade, tighter timing.' },
  axe: { name: 'Battle Axe', dmg: 18, strikes: 2, lead: 900, gap: 650, perfect: 65, good: 140, bleed: 2, minD: 3, desc: 'Cleaves cause bleeding.' },
  staff: { name: 'Hex Staff', dmg: 7, strikes: 4, lead: 820, gap: 380, perfect: 85, good: 175, drift: true, burn: 2, minD: 4, desc: 'Drifting hexes that burn.' },
  hammer: { name: 'Warhammer', dmg: 36, strikes: 1, lead: 1050, gap: 0, perfect: 60, good: 125, stun: 1, minD: 5, desc: 'One crushing blow. Perfect stuns.' },
  crossbow: { name: 'Crossbow', dmg: 28, strikes: 1, lead: 1250, gap: 0, perfect: 55, good: 115, pierce: true, minD: 6, desc: 'Long aim, huge bolt. Pierces.' },
};

export const AFFIXES = {
  flaming: { name: 'Flaming', burn: 2, desc: 'Hits set foes ablaze.' },
  vampiric: { name: 'Vampiric', life: 0.15, desc: 'Heal 15% of damage dealt.' },
  keen: { name: 'Keen', perfect: 30, good: 40, desc: 'Wider timing windows.' },
  brutal: { name: 'Brutal', mul: 1.3, desc: '+30% damage.' },
  swift: { name: 'Swift', strikes: 1, desc: '+1 strike per turn.' },
  piercing: { name: 'Piercing', pierce: true, desc: 'Ignores armor.' },
  blessed: { name: 'Blessed', boss: 1.5, desc: '+50% damage to bosses.' },
};

let uid = 1;
export function makeWeapon(rng, depth, base = null, rarity = null) {
  if (!base) {
    const pool = Object.keys(WEAPONS).filter(k => WEAPONS[k].minD <= depth + 1);
    base = rng.pick(pool);
  }
  if (rarity == null) {
    const r = rng.next();
    rarity = r < 0.03 + depth * 0.006 ? 3 : r < 0.12 + depth * 0.012 ? 2 : r < 0.45 ? 1 : 0;
  }
  const affixes = [];
  const want = Math.min(2, rarity);
  const keys = Object.keys(AFFIXES).filter(k => !(k === 'piercing' && WEAPONS[base].pierce));
  while (affixes.length < want) {
    const a = rng.pick(keys);
    if (!affixes.includes(a)) affixes.push(a);
  }
  const lvl = Math.max(1, depth + rng.int(-1, 1) + (rarity === 3 ? 2 : 0));
  return { base, lvl, rarity, affixes, uid: Date.now().toString(36) + (uid++) };
}

export function weaponName(w) {
  const pre = w.affixes.length ? AFFIXES[w.affixes[0]].name + ' ' : '';
  return pre + WEAPONS[w.base].name;
}

export function weaponStats(w, run) {
  const b = WEAPONS[w.base];
  const s = {
    dmg: b.dmg * (1 + 0.15 * (w.lvl - 1)), strikes: b.strikes, lead: b.lead, gap: b.gap,
    perfect: b.perfect, good: b.good, mul: 1, life: 0, burn: b.burn || 0, bleed: b.bleed || 0,
    pierce: !!b.pierce, boss: 1, heal: b.heal || 0, stun: b.stun || 0, drift: !!b.drift,
  };
  for (const k of w.affixes) {
    const a = AFFIXES[k];
    if (a.burn) s.burn += a.burn;
    if (a.life) s.life += a.life;
    if (a.perfect) s.perfect += a.perfect;
    if (a.good) s.good += a.good;
    if (a.mul) s.mul *= a.mul;
    if (a.strikes) s.strikes += a.strikes;
    if (a.pierce) s.pierce = true;
    if (a.boss) s.boss *= a.boss;
  }
  if (run) {
    const B = run.bless;
    s.perfect += 25 * (B.steady || 0);
    s.good += 35 * (B.keen || 0);
    s.mul *= 1 + 0.2 * (B.brutal || 0);
  }
  s.dmg = Math.max(1, Math.round(s.dmg * s.mul));
  return s;
}

export function weaponTraits(w) {
  const t = [WEAPONS[w.base].desc];
  for (const k of w.affixes) t.push(AFFIXES[k].name + ': ' + AFFIXES[k].desc);
  return t;
}

// ---------- Enemies ----------
// hits: offsets (ms) of each incoming blow. type guard = tap to parry, feint = DON'T tap, orb = tap to smash,
// h.mul scales one hit on top of the attack's mul.
// rune = trace the glyph (one of h.runes) before its curse lands; the trace window is RUNE_TIME, not the attack lead.
const A = (name, hits, lead, mul = 1) => ({
  name, lead, mul,
  hits: hits.map(h => (typeof h === 'number' ? { t: h, type: 'guard' } : { type: 'guard', ...h })),
});
const F = t => ({ t, type: 'feint' });
const O = (t, mul) => ({ t, type: 'orb', mul });
const R = (t, runes) => ({ t, type: 'rune', runes });

// Balance knobs in one place (tools/sim/sim.mjs can override any of them with --set key=value).
export const BAL = {
  foeHpPerFloor: 0.5, // monster HP grows by this share of its floor-1 HP each floor (linear)
  foeDmgPerFloor: 0.11, // same for monster damage
  foeDmg: 1, // flat multiplier on all monster damage
  hpPerLevel: 4, // hero max HP gained per level
  perfectMul: 1.5, // damage of a perfect strike or note
  comboCap: 1, // most a combo can add to damage (1 = +100%)
  guardPerfect: 95, // ms either side for a parry
  guardGood: 190, // ms either side for a block
  blockAbsorb: 0.6, // share of a hit a block soaks up (Iron Guard adds 15% each)
  rhythmMiss: 0.25, // a missed note hurts for this share of the monster's damage
  potionHeal: 0.4, // share of max HP a Life Bottle restores
  potionCooldown: 1000, // ms between bottles in battle
  potionDrop: 0.15, // chance a regular monster drops a bottle
  potionCap: 99, // most Life Bottles you can carry; extras are left behind
};

// Battles run both sides at once; everything speeds up with depth (ring times, gaps, rests, songs).
export const tempoAt = depth => Math.min(1.5, 1 + 0.03 * (depth - 1));
export const HERO_REST = 450; // ms between your strike volleys (before tempo)
export const FOE_REST = 750; // ms between enemy attacks (before tempo)
export const DOT_TICK = 2500; // ms between burn/bleed ticks

export const RUNE_TIME = 2300; // ms to trace an enemy curse rune
export const SIGIL_TIME = 1900; // ms to trace your own sigil after a flawless turn
export const runeTime = (run, base) => Math.round(base * (1 + 0.3 * (run.bless.runic || 0)));

export const ENEMIES = {
  zombie: { name: 'Zombie', hp: 26, dmg: 6, armor: 0, xp: 6, gold: [2, 5], slow: true, blood: '#9cb87a', head: [0.45, 0.18],
    attacks: [A('Claw', [0], 1050), A('Grab', [0, 520], 1000, 0.75)] },
  skeleton: { name: 'Skeleton', hp: 22, dmg: 7, armor: 1, xp: 7, gold: [2, 6], blood: '#e8e0c8', head: [0.5, 0.17],
    attacks: [A('Slash', [0], 900), A('Double Slash', [0, 380], 880, 0.7)] },
  bat: { name: 'Giant Bat', hp: 12, dmg: 4, armor: 0, xp: 4, gold: [1, 3], fast: true, fly: true, blood: '#9a58c0', head: [0.5, 0.5],
    attacks: [A('Swoop', [0, 260, 520], 720, 0.6), A('Bite', [0], 650)] },
  imp: { name: 'Imp', hp: 20, dmg: 6, armor: 0, xp: 8, gold: [3, 7], blood: '#d04040', head: [0.5, 0.3],
    attacks: [A('Trickery', [F(0), 400], 850), A('Firebolt', [O(0)], 1100), A('Poke', [0, 300], 800, 0.6),
      A('Hex Sigil', [R(0, ['vee', 'hook'])], 900, 1.2)] },
  pumpkin: { name: 'Pumpkin Knight', hp: 44, dmg: 9, armor: 2, xp: 13, gold: [4, 10], blood: '#e8822c', head: [0.5, 0.25],
    attacks: [A('Cleave', [0], 950, 1.5), A('Flurry', [0, 330, 660], 880, 0.6)] },
  ghoul: { name: 'Ghoul', hp: 34, dmg: 8, armor: 0, xp: 11, gold: [3, 8], fast: true, blood: '#a898b0', head: [0.5, 0.2],
    attacks: [A('Frenzy', [0, 240, 480, 720], 820, 0.45), A('Rend', [0], 900, 1.2)] },
  wraith: { name: 'Wraith', hp: 30, dmg: 9, armor: 0, xp: 13, gold: [4, 9], fly: true, fade: true, blood: '#70d0e0', head: [0.5, 0.25],
    attacks: [A('Wail', [F(0), F(300), 600], 900), A('Soul Grip', [0, 450], 950, 0.8),
      A('Soul Brand', [R(0, ['tri', 'zig'])], 900, 1.4)] },
  gargoyle: { name: 'Gargoyle', hp: 50, dmg: 10, armor: 4, xp: 16, gold: [5, 12], blood: '#8a8478', head: [0.5, 0.35],
    attacks: [A('Slam', [0], 1100, 1.6), A('Dive', [F(0), 350], 950)] },
  witch: { name: 'Witch', hp: 30, dmg: 8, armor: 0, xp: 15, gold: [6, 12], blood: '#7ac040', head: [0.4, 0.42],
    attacks: [A('Hex Volley', [O(0), O(380), O(760)], 1000, 0.7), A('Curse', [F(0), 300], 850),
      A('Witch Mark', [R(0, ['bolt', 'tri', 'bowtie'])], 900, 1.5)] },
  // Rhythm monsters fight with a song instead of attacks: notes fall down four lanes.
  bard: { name: 'Bone Bard', hp: 40, dmg: 7, armor: 0, xp: 12, gold: [6, 12], blood: '#e8e0c8', head: [0.4, 0.15], attacks: [],
    rhythm: { song: 'Graveside Ballad', bpm: 104, density: 0.55, chords: 0.08 } },
  banshee: { name: 'Banshee', hp: 50, dmg: 10, armor: 0, xp: 17, gold: [7, 14], fly: true, blood: '#c8e0f0', head: [0.5, 0.2], attacks: [],
    rhythm: { song: 'Wailing Requiem', bpm: 124, density: 0.6, chords: 0.22 } },
  mimic: { name: 'Mimic', hp: 40, dmg: 10, armor: 2, xp: 15, gold: [25, 45], blood: '#8a5a3a', head: [0.5, 0.45],
    attacks: [A('Chomp', [0, 300], 850), A('Lunge', [0], 800, 1.4)] },
  pumpkinKing: { name: 'The Pumpkin King', boss: true, hp: 170, dmg: 10, armor: 2, xp: 60, gold: [60, 90], blood: '#e8822c', head: [0.45, 0.35],
    encore: { song: 'Harvest Hoedown', bpm: 112, density: 0.6, chords: 0.12 },
    attacks: [A('Vine Lash', [0, 300, 600], 900, 0.7), A('Seed Barrage', [O(0), O(300), O(600), O(900)], 1100, 0.5),
      A('Gourd Smash', [F(0), F(300), 650], 950, 1.6), A('Root Grab', [0, 500], 850, 0.9),
      A("Jack's Hex", [R(0, ['vee', 'tri', 'hook'])], 900, 1.5)] },
  colossus: { name: 'Bone Colossus', boss: true, hp: 290, dmg: 13, armor: 5, xp: 110, gold: [100, 140], blood: '#e8e0c8', head: [0.45, 0.15],
    encore: { song: 'March of the Ribcage', bpm: 120, density: 0.65, chords: 0.2 },
    attacks: [A('Earthquake', [0, 200, 400, 600], 900, 0.5), A('Skull Toss', [O(0), O(450)], 1000, 0.9),
      A('Crush', [F(0), 400], 1000, 1.8), A('Bone Glyph', [R(0, ['zig', 'bowtie']), F(500), F(1100)], 900, 1.6),
      A('Rib Rattle', [0, 250, F(500), 750], 850, 0.6)] },
  lich: { name: 'Lich Morthos', boss: true, hp: 380, dmg: 15, armor: 3, xp: 200, gold: [150, 220], blood: '#9a58c0', head: [0.38, 0.2],
    encore: { song: 'Danse Macabre', bpm: 132, density: 0.7, chords: 0.3 },
    attacks: [A('Soul Storm', [O(0), O(250), O(500), O(750), O(1000)], 1000, 0.5), A('Death Grip', [F(0), F(250), 500, 800], 900, 0.8),
      A('Doom Sigil', [R(0, ['crown', 'bolt', 'bowtie']), O(600, 0.3), O(1200, 0.3)], 1300, 2.0), A('Phantom Blades', [0, 220, 440, F(660), 880], 800, 0.55)] },
};

export function scaleEnemy(type, depth) {
  const d = ENEMIES[type];
  const k = depth - 1;
  const hp = Math.round(d.hp * (1 + BAL.foeHpPerFloor * k));
  return { hp, maxHp: hp, dmg: Math.round(d.dmg * BAL.foeDmg * (1 + BAL.foeDmgPerFloor * k)), armor: d.armor + Math.floor(depth / 6) };
}

// ---------- Blessings (level-up perks) ----------
export const BLESSINGS = [
  { id: 'vigor', name: 'Bone Plating', desc: '+15 max HP and heal 15.' },
  { id: 'steady', name: 'Steady Hand', desc: 'Perfect window +25ms.' },
  { id: 'keen', name: 'Keen Eye', desc: 'Good window +35ms.' },
  { id: 'brutal', name: 'Brutality', desc: '+20% weapon damage.' },
  { id: 'riposte', name: 'Riposte', desc: 'Parries hit twice as hard.' },
  { id: 'guard', name: 'Iron Guard', desc: 'Blocks absorb 15% more.' },
  { id: 'alchemy', name: 'Alchemy', desc: 'Life bottles heal 50% more.' },
  { id: 'greed', name: 'Greed', desc: '+40% gold found.' },
  { id: 'necro', name: 'Necromancy', desc: 'Heal 12% max HP after victories.' },
  { id: 'combo', name: 'Combo Master', desc: 'Combo damage bonus +50%.' },
  { id: 'undying', name: 'Undying', desc: 'Cheat death once.' },
  { id: 'thorns', name: 'Thorns', desc: 'Attackers take 4 damage per hit.' },
  { id: 'leech', name: 'Soul Leech', desc: 'Perfect strikes heal 1 HP.' },
  { id: 'bottle', name: 'Bottle Bearer', desc: 'Gain 2 life bottles now.' },
  { id: 'runic', name: 'Rune Lore', desc: 'Runes last 30% longer and hit 50% harder.' },
];

export function pickBlessings(rng, run, n = 3) {
  const pool = BLESSINGS.filter(b => !(b.id === 'guard' && (run.bless.guard || 0) >= 2));
  return rng.shuffle(pool.slice()).slice(0, n);
}

export function applyBlessing(run, id) {
  run.bless[id] = (run.bless[id] || 0) + 1;
  if (id === 'vigor') { run.maxHp += 15; run.hp = Math.min(run.maxHp, run.hp + 15); }
  if (id === 'bottle') addPotions(run, 2);
}

export const xpNeed = level => Math.floor(16 + level * 12 + level * level * 2);
export const potionHeal = run => Math.round(run.maxHp * BAL.potionHeal * (1 + 0.5 * (run.bless.alchemy || 0)));
export const potionRoom = run => Math.max(0, BAL.potionCap - run.potions);
// Add bottles up to the carry cap; returns how many fit.
export function addPotions(run, n = 1) { const k = Math.min(n, potionRoom(run)); run.potions += k; return k; }
export const goldMul = run => 1 + 0.4 * (run.bless.greed || 0);

// Grant XP; returns number of levels gained.
export function gainXp(run, xp) {
  run.xp += xp;
  let n = 0;
  while (run.xp >= xpNeed(run.level)) {
    run.xp -= xpNeed(run.level);
    run.level++; n++;
    run.maxHp += BAL.hpPerLevel; run.hp = Math.min(run.maxHp, run.hp + BAL.hpPerLevel);
  }
  run.levelUps = (run.levelUps || 0) + n;
  return n;
}
