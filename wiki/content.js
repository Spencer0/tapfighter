// Wiki page content. Stats are computed from ../src/data.js; prose is hand-written.
import {
  THEMES, WEAPONS, AFFIXES, ENEMIES, BLESSINGS, RARITY, FINAL_DEPTH, scaleEnemy, xpNeed, weaponStats,
} from '../src/data.js';
import { SPR, weaponIcon } from '../src/sprites.js';
import { makeBackdrop } from '../src/backdrop.js';
import { getTiles } from '../src/tiles.js';
import { generate, MW, MH } from '../src/dungeon.js';
import { makeCanvas } from '../src/gfx.js';

export const SIDEBAR = [
  ['Navigation', [['Main page', 'Main_Page'], ['Getting started', 'Getting_started'], ['Random page', '@random'], ['Update history', 'Update_history']]],
  ['Guides', [['Combat', 'Combat'], ['Timing windows', 'Timing_windows'], ['Damage formula', 'Damage_formula'], ['Status effects', 'Status_effects'],
    ['Exploration', 'Exploration'], ['Strategy guide', 'Strategy_guide'], ['Boss guide', 'Bosses'], ['Controls', 'Controls']]],
  ['Game', [['Sir Rattlebone', 'Sir_Rattlebone'], ['Bestiary', 'Bestiary'], ['Weapons', 'Weapons'], ['Affixes', 'Affixes'], ['Rarity', 'Rarity'],
    ['Blessings', 'Blessings'], ['Items', 'Items'], ['Merchant', 'Merchant'], ['Objects', 'Objects'], ['Locations', 'Locations'], ['Experience', 'Experience']]],
  ['Play', [['Play Tapfighter', '../'], ['Source code', 'https://github.com/Spencer0/tapfighter']]],
];

// ---------- derived data ----------
const ORDER = ['zombie', 'skeleton', 'bat', 'imp', 'pumpkin', 'ghoul', 'wraith', 'gargoyle', 'witch', 'mimic'];
const BOSSES = ['pumpkinKing', 'colossus', 'lich'];
const WORDER = ['sword', 'dagger', 'drumstick', 'club', 'spear', 'broad', 'axe', 'staff', 'hammer', 'crossbow'];
const PAGE_OF = {
  zombie: 'Zombie', skeleton: 'Skeleton', bat: 'Giant_Bat', imp: 'Imp', pumpkin: 'Pumpkin_Knight', ghoul: 'Ghoul', wraith: 'Wraith',
  gargoyle: 'Gargoyle', witch: 'Witch', mimic: 'Mimic', pumpkinKing: 'The_Pumpkin_King', colossus: 'Bone_Colossus', lich: 'Lich_Morthos',
};
const WPAGE = Object.fromEntries(Object.entries(WEAPONS).map(([k, w]) => [k, w.name.replace(/ /g, '_')]));
const THEME_PAGE = { graveyard: 'Boneyard', crypt: 'Crypts', cathedral: 'Cursed_Cathedral' };
const floorsOfTheme = i => [1, 2, 3, 4, 5].map(n => i * 5 + n);
const hitDmg = (type, d, mul) => Math.max(1, Math.round(scaleEnemy(type, d).dmg * mul));
const xpAt = (type, d) => Math.round(ENEMIES[type].xp * (1 + 0.15 * (d - 1)));
const goldAt = (type, d) => ENEMIES[type].gold.map(g => Math.round(g * (1 + 0.1 * (d - 1))));
const firstAvail = k => Math.max(1, WEAPONS[k].minD - 1);

// Spawn share (%) of each enemy on a given floor.
function spawnTable(depth) {
  const th = THEMES[Math.floor((depth - 1) / 5) % THEMES.length];
  const pool = th.enemies.filter(([, minD]) => minD <= depth);
  const total = pool.reduce((s, p) => s + p[2], 0);
  return pool.map(([t, , w]) => [t, (w / total) * 100]);
}
function appearances(type) {
  const out = [];
  for (let d = 1; d <= FINAL_DEPTH; d++) {
    const row = spawnTable(d).find(([t]) => t === type);
    if (row) out.push([d, row[1]]);
  }
  return out;
}
const fmtFloors = list => {
  if (!list.length) return 'None';
  const parts = []; let a = list[0], b = list[0];
  for (const n of list.slice(1)) { if (n === b + 1) b = n; else { parts.push(a === b ? `${a}` : `${a}-${b}`); a = b = n; } }
  parts.push(a === b ? `${a}` : `${a}-${b}`);
  return parts.join(', ');
};

// ---------- prose ----------
const MON = {
  zombie: {
    intro: 'shambling corpses that lurch out of fresh graves. They are the first monster most heroes meet and the gentlest introduction to defending.',
    strat: 'Zombies are <b>slow</b>: on the map they only move every other turn, so you can always walk away from one. In battle both attacks are long, readable wind-ups, so this is the ideal monster to practise parrying on. Parry both hands of <i>Grab</i> to stagger it for a free extra strike.',
    trivia: 'The zombie\'s blue trousers are the only clothing in the Boneyard that is not in tatters.',
  },
  skeleton: {
    intro: 'animated bones of the Boneyard\'s lesser dead. Unlike Sir Rattlebone they never got their dignity back.',
    strat: 'Skeletons wear a scrap of rusty armour (<b>1 armour</b> on floor 1), which takes a big bite out of small hits, so a Dagger loses a quarter of its damage. <i>Double Slash</i> lands two shields 380ms apart: tap in rhythm, not in a panic.',
    trivia: 'Their glowing red eyes are the only part of them that can be targeted for critical hits.',
  },
  bat: {
    intro: 'oversized vermin that swarm through every tunnel. Individually weak, they are dangerous because they are <b>fast</b>.',
    strat: 'Bats move <b>two tiles per turn</b>, so you cannot outrun them. They have the lowest HP of any monster, but <i>Swoop</i> throws three shields in quick succession with the shortest ring time of the early game. If you miss timing, block rather than whiff: a Good tap still absorbs 60% of the damage.',
    trivia: 'Giant Bats appear in both the Boneyard and the Crypts.',
  },
  imp: {
    intro: 'mischievous little devils that join the Boneyard from floor 2. They introduce the two trickiest mechanics in the game: <b>feints</b> and <b>orbs</b>.',
    strat: '<i>Trickery</i> opens with a purple <b>skull feint</b>. Tapping it costs you 60% of a hit and your combo. Wait for the real shield 400ms later. <i>Firebolt</i> is a slow-moving green <b>orb</b>: tap it at any point in its flight. Learn the Imp well, because its tricks return in much nastier forms later.',
    trivia: 'The Imp is the only regular monster with all three defensive mark types in its moveset.',
  },
  pumpkin: {
    intro: 'jack-o\'-lantern headed knights in plate armour. The Pumpkin King\'s personal guard.',
    strat: 'A big step up: <b>2 armour</b> and a heavy <i>Cleave</i> that hits for 150% damage. Always parry the Cleave. <i>Flurry</i> is three fast shields; if you can parry all three you stagger it. Use a piercing weapon (Spear, Crossbow) or a heavy hitter so the armour does not eat your damage.',
    trivia: 'Pumpkin Knights are the only monster found in all three regions.',
  },
  ghoul: {
    intro: 'hunched corpse-eaters with long claws that haunt the Crypts.',
    strat: 'Ghouls are <b>fast</b> on the map and have the longest single combo of any regular monster: <i>Frenzy</i> lands <b>four</b> shields 240ms apart. Each hit is weak (45%), so even blocking all four is survivable, but parrying them all gives a stagger. <i>Rend</i> is a single heavy swipe.',
    trivia: 'Ghouls never sleep standing up; that is just how they look.',
  },
  wraith: {
    intro: 'tormented spirits that drift through the deeper Crypts and the Cathedral. They are the hardest monster to read.',
    strat: 'Wraiths are <b>spectral</b>: their shields and skulls are <b>invisible until 45% of the ring time remains</b>. You will only see a faint outline at first. <i>Wail</i> is two feints followed by one real shield; tapping anything early is a mistake. Watch the faint outlines to learn where the marks will appear.',
    trivia: 'Wraiths are drawn slightly transparent in battle.',
  },
  gargoyle: {
    intro: 'living stone statues that guard the Cursed Cathedral.',
    strat: 'The best-armoured regular monster (<b>4 armour</b>, more on later floors). Without a piercing weapon, Daggers and Chicken Legs barely scratch it. <i>Slam</i> hits for <b>160%</b> damage, so never miss that parry. <i>Dive</i> fakes you out with a skull first.',
    trivia: 'Gargoyles drop the most coins of any non-boss monster except the Mimic.',
  },
  witch: {
    intro: 'cackling hags of the Cursed Cathedral who fight entirely from range.',
    strat: '<i>Hex Volley</i> fires <b>three orbs</b>. They arc across the screen, so tap them early in flight rather than waiting for them to reach you. <i>Curse</i> is a feint followed by a shield. Witches have low HP, so rush them down with multi-hit weapons.',
    trivia: 'The witch carries her broom into battle but never rides it.',
  },
  mimic: {
    intro: 'monsters disguised as treasure chests. From floor 3 onward, <b>15% of chests</b> are Mimics.',
    strat: 'There is no way to tell a Mimic from a real chest before opening it. Opening one starts a fight immediately, and you cannot get the first strike. It hits hard (<i>Lunge</i> does 140%) and has 2 armour, but it pays out <b>25-45 coins</b> (more on deeper floors), far more than any other regular monster. If you are low on health, skipping chests on deeper floors is a legitimate choice.',
    trivia: 'The Mimic\'s tongue is the only red in its sprite.',
  },
  pumpkinKing: {
    intro: 'ruler of the Boneyard and the first boss, waiting at the bottom of floor 5. Many runs end here.',
  },
  colossus: {
    intro: 'a towering heap of bones fused into one titan. It guards the bottom of the Crypts on floor 10.',
  },
  lich: {
    intro: 'the necromancer who raised the dead of the realm, including Sir Rattlebone. He is the final boss, on floor 15 of the Cursed Cathedral.',
  },
};

const WTXT = {
  sword: 'The starting weapon. Three strikes with generous timing make it the best all-rounder for learning the game. It falls off once armour climbs past 3-4, so replace it with a Broadsword or a piercing weapon.',
  dagger: 'Also part of the starting kit. Five fast stabs build combos very quickly, and combo bonus multiplies every later hit, including parries. Its tiny per-hit damage makes it terrible against <b>armour</b>, which is subtracted from every hit, so swap away against Skeletons, Pumpkin Knights and Gargoyles.',
  drumstick: 'A joke weapon that is secretly good. Every Good or Perfect hit <b>heals 2 HP</b>, and it has the widest timing windows in the game (110ms perfect). Damage is pitiful, so use it to top up health against weak monsters between floors.',
  club: 'Two big swings with forgiving timing. Each <b>Perfect</b> hit has a <b>35% chance to stun</b>, which makes the monster skip its next attack.',
  spear: '<b>Pierces armour</b>. That makes it the best-value weapon against Pumpkin Knights, Gargoyles and every boss. Three quick strikes with slightly tight timing.',
  broad: 'A straight upgrade to the Short Sword: about 50% more damage per hit but tighter windows (75ms perfect).',
  axe: 'Two crushing blows with a narrow perfect window. Every hit adds <b>2 bleed</b>, which deals damage at the start of each enemy turn and stacks with repeated hits.',
  staff: 'The only weapon with <b>moving targets</b>: hexes drift slowly across the monster while their ring closes. Every hit adds <b>2 burn</b>. Four strikes per turn.',
  hammer: 'One enormous blow per turn with a long ring and a strict 60ms perfect window. A Perfect hit <b>always stuns</b> (if the monster is not already stunned), so a skilled player can keep a monster from ever attacking. Missing the single strike wastes the whole turn.',
  crossbow: 'One bolt per turn, the longest aim (1250ms) and the tightest perfect window (55ms) in the game. It <b>pierces armour</b> and has the highest base damage per strike after the Warhammer.',
};

export function buildPages(H) {
  const { img, link, table, infobox, navbox, chip, note, h2, toc } = H;
  const mlink = t => link(PAGE_OF[t], ENEMIES[t].name);
  const wlink = k => link(WPAGE[k], WEAPONS[k].name);
  const micon = (t, s = 2) => img(SPR[t], s, ENEMIES[t].name);
  const wicon = (k, s = 2) => img(weaponIcon(k), s, WEAPONS[k].name);
  const potion = (s = 2) => img(SPR.potion, s, 'Life Bottle');
  const coin = img(SPR.coin, 2, 'Coins');
  const markName = { guard: 'Shield', feint: 'Skull', orb: 'Orb' };

  const bestiaryNav = () => navbox('Monsters of Tapfighter', [
    ['Boneyard', ['zombie', 'skeleton', 'bat', 'imp', 'pumpkin'].map(mlink)],
    ['Crypts', ['skeleton', 'ghoul', 'bat', 'zombie', 'wraith', 'pumpkin'].map(mlink)],
    ['Cursed Cathedral', ['gargoyle', 'witch', 'wraith', 'imp', 'ghoul', 'pumpkin'].map(mlink)],
    ['Chests', [mlink('mimic')]],
    ['Bosses', BOSSES.map(mlink)],
  ]);
  const weaponNav = () => navbox('Weapons', [
    ['Bladed', ['sword', 'dagger', 'broad', 'axe'].map(wlink)],
    ['Blunt', ['club', 'hammer', 'drumstick'].map(wlink)],
    ['Piercing', ['spear', 'crossbow'].map(wlink)],
    ['Magic', [wlink('staff')]],
    ['See also', [link('Affixes'), link('Rarity'), link('Weapons')]],
  ]);
  const guideNav = () => navbox('Guides', [
    ['Mechanics', [link('Combat'), link('Timing_windows', 'Timing windows'), link('Damage_formula', 'Damage formula'), link('Status_effects', 'Status effects'), link('Exploration')]],
    ['Help', [link('Getting_started', 'Getting started'), link('Strategy_guide', 'Strategy guide'), link('Bosses', 'Boss guide'), link('Controls')]],
  ]);

  const attackTable = (t, floor) => {
    const d = ENEMIES[t];
    return table(['Attack', 'Pattern (time after first mark)', 'Ring time', 'Dmg per hit', `Hit on floor ${floor}`],
      d.attacks.map(a => [
        `<b>${a.name}</b>`,
        { html: a.hits.map(h => chip(h.type, `${markName[h.type]} +${h.t}ms`)).join(' ') },
        `${a.lead}ms`, `${Math.round(a.mul * 100)}%`, hitDmg(t, floor, a.mul),
      ]));
  };

  const monsterPage = t => {
    const d = ENEMIES[t];
    const isBoss = !!d.boss;
    const app = appearances(t);
    const themeIdx = THEMES.findIndex(th => th.boss === t);
    const first = isBoss ? (themeIdx + 1) * 5 : t === 'mimic' ? 3 : app[0][0];
    const s = scaleEnemy(t, first);
    const regions = isBoss ? [THEMES[themeIdx]] : THEMES.filter(th => th.enemies.some(([e]) => e === t));
    const speed = isBoss ? 'Stationary (guards the stairs)' : d.slow ? 'Slow (moves every other turn)' : d.fast ? 'Fast (2 tiles per turn)' : 'Normal (1 tile per turn)';
    const traits = [];
    if (d.fly) traits.push('Flying');
    if (d.fade) traits.push('Spectral (marks fade in late)');
    if (isBoss) traits.push('Boss: fixed attack rotation, enrages below 50% HP');
    const ib = infobox({
      title: d.name, image: img(SPR[t], isBoss ? 4 : 5, d.name),
      sections: [
        { head: 'Info', rows: [
          ['Region', regions.map(r => link(THEME_PAGE[r.id], r.name)).join(', ')],
          ['Floors', isBoss ? `${first} (boss)` : t === 'mimic' ? '3+ (inside chests)' : fmtFloors(app.map(a => a[0]))],
          ['Movement', speed],
          ['Traits', traits.join('<br>') || 'None'],
        ] },
        { head: `Combat stats (floor ${first})`, rows: [
          ['Hitpoints', s.hp], ['Base damage', s.dmg], ['Armour', s.armor],
          ['Attacks', d.attacks.length], ['Experience', xpAt(t, first)],
          ['Coins', goldAt(t, first).join('-')],
        ] },
      ],
    });
    const floors = isBoss ? [first, first + 15, first + 30] : t === 'mimic' ? [3, 5, 8, 10, 13, 15] : app.map(a => a[0]);
    const scaling = table(['Floor', 'Hitpoints', 'Base dmg', 'Armour', 'Experience', 'Coins'],
      floors.map(f => { const x = scaleEnemy(t, f); return [f, x.hp, x.dmg, x.armor, xpAt(t, f), goldAt(t, f).join('-')]; }));
    const plural = d.name.endsWith('h') ? 'es' : 's';
    let body = ib + `<p><b>${d.name}</b>${isBoss ? ' is' : plural + ' are'} ${MON[t].intro}</p>`;
    body += h2('Attacks');
    body += `<p>${isBoss ? `Bosses use their attacks in a <b>fixed rotation</b>, starting from the top of this table and looping.` : `Each turn the ${d.name} picks one of these attacks at random.`} ${chip('guard', 'Shield')} = tap on time to parry; ${chip('feint', 'Skull')} = feint, do <b>not</b> tap; ${chip('orb', 'Orb')} = projectile, tap to smash. See ${link('Combat')} for details.</p>`;
    body += attackTable(t, first);
    if (isBoss) body += note(`<b>Enrage:</b> below 50% HP (${Math.ceil(s.hp / 2)} HP on floor ${first}) every ring closes <b>15% faster</b> and the gaps between hits shrink by the same amount.`, true);
    if (!isBoss) {
      body += h2('Strategy') + `<p>${MON[t].strat}</p>`;
    } else body += bossStrategy(t, first);
    body += h2('Locations');
    if (isBoss) body += `<p>Always found on floor ${first}, standing on the stairs down in the boss arena of the ${link(THEME_PAGE[THEMES[themeIdx].id], THEMES[themeIdx].name)}. In ${link('Endless_mode', 'Endless mode')} it returns on floors ${first + 15} and ${first + 30}, stronger each time. The stairs only appear once it is destroyed.</p>`;
    else if (t === 'mimic') body += `<p>Mimics never appear on their own. From floor 3 onward each chest has a 15% chance to be a Mimic. See ${link('Chest')}.</p>`;
    else body += `<p>Share of all monster spawns on each floor where it appears:</p>` + table(['Floor', 'Region', 'Spawn share'], app.map(([f, p]) => {
      const th = THEMES[Math.floor((f - 1) / 5)];
      return [f, link(THEME_PAGE[th.id], th.name), `${p.toFixed(1)}%`];
    }));
    body += h2('Scaling') + `<p>Monster stats grow with the floor: HP by +20% per floor, damage by +11% per floor, and armour by +1 every 6 floors. See ${link('Damage_formula', 'Damage formula')}.</p>` + scaling;
    body += h2('Drops');
    body += table(['Item', 'Quantity', 'Rarity'], [
      [`${coin} ${link('Coins')}`, goldAt(t, first).join('-') + ` (floor ${first})`, 'Always'],
      [`${potion()} ${link('Life_Bottle', 'Life Bottle')}`, 1, isBoss ? 'Always' : '15%'],
      [`${wicon('sword')} Random weapon`, 1, isBoss ? 'Always (Epic 65% / Legendary 35%, level floor+1)' : '10%'],
    ]);
    if (MON[t].trivia) body += h2('Trivia') + `<ul><li>${MON[t].trivia}</li></ul>`;
    body += bestiaryNav();
    return body;
  };

  function bossStrategy(t, f) {
    const s = scaleEnemy(t, f);
    const d = ENEMIES[t];
    const dm = mul => hitDmg(t, f, mul);
    let h = h2('Strategy');
    if (t === 'pumpkinKing') {
      h += `<p>The Pumpkin King is a big jump in difficulty from the floors before him: <b>${s.hp} HP</b>, <b>${s.armor} armour</b>, and a four-attack rotation. A few habits make him much easier:</p>
<ol>
<li><b>Bring the right weapon.</b> His armour removes ${s.armor} damage from every strike. A level-1 Dagger loses half its damage per stab; a ${wlink('spear')}, ${wlink('crossbow')} or any heavy weapon does not care. Parry counters always ignore armour.</li>
<li><b>Learn the rotation.</b> It is always the same order: <i>Vine Lash</i>, <i>Seed Barrage</i>, <i>Gourd Smash</i>, <i>Root Grab</i>, then repeat.</li>
<li><b>Vine Lash</b> (3 shields, ${dm(0.7)} each): parry all three and he is <b>staggered</b>, giving you a bonus strike next turn.</li>
<li><b>Seed Barrage</b> (4 orbs, ${dm(0.5)} each): tap each seed as soon as it leaves him. They come 300ms apart; do not wait for them to arc down to you.</li>
<li><b>Gourd Smash</b> is the run-killer: <b>two skull feints</b> and then a real shield at +650ms that hits for <b>${dm(1.6)}</b>. Most deaths here come from tapping a skull out of nerves (which loses your combo and costs ${Math.max(1, Math.round(dm(1.6) * 0.6))} HP) or missing the real shield. Keep your thumbs still until the cyan shield appears.</li>
<li><b>Root Grab</b> (2 shields, ${dm(0.9)} each, 500ms apart) is slow and easy. Relax and parry.</li>
<li><b>Below ${Math.ceil(s.hp / 2)} HP he enrages</b> and everything is 15% faster. Save a ${link('Life_Bottle', 'Life Bottle')} for this phase, and drink it during <i>his</i> turn if you can, because drinking during your strike turn ends your turn.</li>
</ol>
${note(`<b>Preparation checklist:</b> reach about level 4-5, carry 3+ Life Bottles (the ${link('Merchant')} always appears on floor 3), use any ${link('Fountain')} on floors 4-5 before descending, and pick defensive ${link('Blessings')} such as Iron Guard or Riposte if offered.`)}`;
    } else if (t === 'colossus') {
      h += `<p>The Bone Colossus has the highest armour in the game (<b>${s.armor}</b> on floor ${f}). Bring a piercing weapon or you will be doing single-digit damage.</p>
<ul>
<li><b>Earthquake</b>: four shields 200ms apart (${dm(0.5)} each). This is the fastest burst in the game. If you can't parry it, block it: Good taps still absorb most of the damage.</li>
<li><b>Skull Toss</b>: two orbs that hit for ${dm(0.9)} each. Smash them early.</li>
<li><b>Crush</b>: a skull feint then a real shield 400ms later that hits for <b>${dm(1.8)}</b>, the hardest single hit before the Lich.</li>
<li><b>Rib Rattle</b>: shield, shield, <b>skull</b>, shield. The feint hidden in the middle of a rhythm catches people who tap on autopilot.</li>
</ul>`;
    } else {
      h += `<p>Lich Morthos is the final boss: <b>${s.hp} HP</b>, ${s.armor} armour, and the most demanding patterns in the game.</p>
<ul>
<li><b>Soul Storm</b>: <b>five orbs</b> 250ms apart (${dm(0.5)} each). Tap them in order as they launch.</li>
<li><b>Death Grip</b>: two skulls, then two real shields (${dm(0.8)} each).</li>
<li><b>Doom</b>: a single shield with a long 1300ms ring that hits for <b>${dm(2.2)}</b>. The long ring makes it easy to tap too early. Wait for the ring to touch the centre.</li>
<li><b>Phantom Blades</b>: five marks with a skull in fourth position. Parry, parry, parry, <i>stop</i>, parry.</li>
</ul>
<p>Defeating him wins the game: you may retire as a legend or continue into ${link('Endless_mode', 'Endless mode')}.</p>`;
    }
    return h;
  }

  const weaponPage = k => {
    const w = WEAPONS[k];
    const base = weaponStats({ base: k, lvl: 1, rarity: 0, affixes: [] }, null);
    const specials = [];
    if (w.pierce) specials.push('Pierces armour');
    if (w.stun) specials.push(`${Math.round(w.stun * 100)}% stun on Perfect`);
    if (w.bleed) specials.push(`+${w.bleed} bleed per hit`);
    if (w.burn) specials.push(`+${w.burn} burn per hit`);
    if (w.heal) specials.push(`Heals ${w.heal} HP per hit`);
    if (w.drift) specials.push('Targets drift');
    const ib = infobox({
      title: w.name, image: img(weaponIcon(k), 6, w.name), caption: w.desc,
      sections: [
        { head: 'Properties', rows: [
          ['Found from', `Floor ${firstAvail(k)}`], ['Starting weapon', k === 'sword' || k === 'dagger' ? 'Yes' : 'No'],
          ['Special', specials.join('<br>') || 'None'],
        ] },
        { head: 'Combat (level 1)', rows: [
          ['Damage per strike', base.dmg], ['Strikes per turn', base.strikes],
          ['Ring time', `${w.lead}ms`], ['Gap between strikes', w.gap ? `${w.gap}ms` : 'n/a'],
          ['Perfect window', `±${w.perfect}ms`], ['Good window', `±${w.good}ms`],
          ['Turn damage (all Good)', base.dmg * base.strikes], ['Turn damage (all Perfect)', Math.round(base.dmg * 1.5) * base.strikes],
        ] },
      ],
    });
    let body = ib + `<p>The <b>${w.name}</b> is a weapon in Tapfighter. ${WTXT[k]}</p>`;
    body += h2('Damage by level') + `<p>Weapon damage grows by +15% of its base per level. A weapon's level is usually the floor it was found on ±1 (Legendaries get +2). Values below ignore combo, crits and armour.</p>`;
    const levels = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 17];
    body += table(['Level', 'Damage', 'Perfect hit', 'Perfect crit', 'Turn (all Perfect)'], levels.map(l => {
      const s = weaponStats({ base: k, lvl: l, rarity: 0, affixes: [] }, null);
      return [l, s.dmg, Math.round(s.dmg * 1.5), Math.round(s.dmg * 1.5 * 1.4), Math.round(s.dmg * 1.5) * s.strikes];
    }));
    body += h2('Against armour') + `<p>Armour is subtracted from every strike${w.pierce ? ', <b>but this weapon pierces it</b>' : ''}. Effective damage of a level-${Math.max(1, firstAvail(k))} ${w.name} (Good hit) against:</p>`;
    const lv = Math.max(1, firstAvail(k));
    const s1 = weaponStats({ base: k, lvl: lv, rarity: 0, affixes: [] }, null);
    body += table(['Monster', 'Armour (first floor)', 'Damage per hit', 'Damage per turn'], ['skeleton', 'pumpkin', 'mimic', 'gargoyle', 'pumpkinKing', 'colossus', 'lich'].map(t => {
      const f = ENEMIES[t].boss ? (THEMES.findIndex(th => th.boss === t) + 1) * 5 : t === 'mimic' ? 3 : appearances(t)[0][0];
      const a = scaleEnemy(t, f).armor;
      const per = Math.max(1, s1.dmg - (s1.pierce ? 0 : a));
      return [`${micon(t, 1)} ${mlink(t)}`, a, per, per * s1.strikes];
    }));
    body += weaponNav();
    return body;
  };

  const P = {};
  const page = (id, title, render, cats = [], keywords = '') => { P[id] = { title, render, cats, keywords }; };

  // ---------- Monster & weapon pages ----------
  for (const t of [...ORDER, ...BOSSES]) page(PAGE_OF[t], ENEMIES[t].name, () => monsterPage(t), ENEMIES[t].boss ? ['Bosses', 'Bestiary'] : ['Bestiary'], t);
  for (const k of WORDER) page(WPAGE[k], WEAPONS[k].name, () => weaponPage(k), ['Weapons'], k);

  return addGuidePages(H, page, P, { mlink, wlink, micon, wicon, potion, coin, bestiaryNav, weaponNav, guideNav, markName });
}

// Guide/list pages live in pages2.js-style section below.
import { addGuidePages } from './guides.js';
export { ORDER, BOSSES, WORDER, PAGE_OF, WPAGE, THEME_PAGE, floorsOfTheme, hitDmg, xpAt, goldAt, firstAvail, spawnTable, appearances, fmtFloors, makeBackdrop, getTiles, generate, MW, MH, makeCanvas };
