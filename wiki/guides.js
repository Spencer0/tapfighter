// Guide, list, item, object and location pages.
import {
  THEMES, WEAPONS, AFFIXES, ENEMIES, BLESSINGS, RARITY, FINAL_DEPTH, RUNE_TIME, SIGIL_TIME, scaleEnemy, xpNeed, weaponStats,
  tempoAt, HERO_REST, FOE_REST, DOT_TICK,
} from '../src/data.js';
import { RHYTHM_PERFECT, RHYTHM_GOOD } from '../src/rhythm.js';
import { RUNES } from '../src/runes.js';
import { SPR, weaponIcon } from '../src/sprites.js';
import {
  ORDER, BOSSES, WORDER, PAGE_OF, WPAGE, THEME_PAGE, floorsOfTheme, goldAt, xpAt, firstAvail, spawnTable, fmtFloors,
  makeBackdrop, getTiles, generate, MW, MH, makeCanvas,
} from './content.js';

const stat = k => weaponStats({ base: k, lvl: 1, rarity: 0, affixes: [] }, null);
const rarityOdds = d => {
  const leg = 0.03 + d * 0.006, epicCut = 0.12 + d * 0.012;
  return [0.55, 0.45 - epicCut, epicCut - leg, leg].map(x => (x * 100).toFixed(1) + '%');
};

export function addGuidePages(H, page, P, X) {
  const { img, link, table, infobox, navbox, chip, note, h2, toc } = H;
  const { mlink, wlink, micon, wicon, potion, coin, bestiaryNav, weaponNav, guideNav } = X;
  const elixir = img(SPR.potion, 2, 'Bone Elixir');
  const star = (s = 2) => img(SPR.star, s, 'Blessing');

  // ---------- Main page ----------
  page('Main_Page', 'Main Page', () => {
    const facts = [
      `The ${wlink('drumstick')} has the widest timing windows of any weapon in the game.`,
      `${mlink('mimic')}s hide in 15% of chests from floor 3 onward.`,
      `Bosses always use their attacks in the same order. Learn the rotation! See ${link('Bosses', 'Boss guide')}.`,
      `Parrying every shield in an enemy attack <b>staggers</b> it, adding an extra strike to your next volley.`,
      `${mlink('wraith')}s hide their marks until the last moment.`,
      `A Perfect ${wlink('hammer')} hit always stuns. Skilled players can stop a monster from ever attacking.`,
    ];
    const fact = facts[Math.floor(Date.now() / 8.64e7) % facts.length];
    return `
<div class="mp-banner">${img(SPR.hero, 5, 'Sir Rattlebone')}
<div><h1 style="border:0;margin:0">Welcome to the Tapfighter Wiki</h1>
<p>The wiki about <b>Tapfighter: The Boneyard Crawl</b>, a mobile pixel-art roguelike where you fight by <b>tapping targets with good timing</b>. It currently has <b>${Object.keys(P).length}</b> pages.</p>
<p>Guide the skeleton knight ${link('Sir_Rattlebone', 'Sir Rattlebone')} through ${FINAL_DEPTH} floors of the ${link('Boneyard')}, the ${link('Crypts')} and the ${link('Cursed_Cathedral', 'Cursed Cathedral')}, and destroy ${mlink('lich')}.</p>
<p><a href="../"><b>Play Tapfighter now &raquo;</b></a> &middot; New here? Read ${link('Getting_started', 'Getting started')}.</p></div></div>
<div class="mp-grid">
<div class="portal"><h2>Bestiary</h2><div class="body"><div class="icon-list">${ORDER.map(t => `<a href="#${PAGE_OF[t]}">${micon(t, 2)}${ENEMIES[t].name}</a>`).join('')}</div><p>${link('Bestiary', 'Full bestiary &raquo;')}</p></div></div>
<div class="portal"><h2>Bosses</h2><div class="body"><div class="icon-list">${BOSSES.map(t => `<a href="#${PAGE_OF[t]}">${micon(t, 2)}${ENEMIES[t].name}</a>`).join('')}</div>
<p>Stuck on a boss? The ${link('Bosses', 'Boss guide')} breaks down every attack rotation.</p></div></div>
<div class="portal"><h2>Weapons</h2><div class="body"><div class="icon-list">${WORDER.map(k => `<a href="#${WPAGE[k]}">${wicon(k, 3)}${WEAPONS[k].name}</a>`).join('')}</div><p>${link('Weapons', 'Compare all weapons &raquo;')}</p></div></div>
<div class="portal"><h2>Guides</h2><div class="body"><ul>
<li>${link('Getting_started', 'Getting started')}: your first run</li>
<li>${link('Combat')}: strikes, parries, orbs and feints</li>
<li>${link('Timing_windows', 'Timing windows')}: exact millisecond windows</li>
<li>${link('Damage_formula', 'Damage formula')}: how every number is calculated</li>
<li>${link('Exploration')}: turns, sight, waking monsters</li>
<li>${link('Strategy_guide', 'Strategy guide')}: tips from floor 1 to 15</li></ul></div></div>
<div class="portal"><h2>Shopping &amp; items</h2><div class="body"><ul>
<li>${potion(1)} ${link('Life_Bottle', 'Life Bottle')} &middot; ${elixir} ${link('Bone_Elixir', 'Bone Elixir')} &middot; ${star(1)} ${link('Blessing_Scroll', 'Blessing Scroll')}</li>
<li>${img(SPR.merchant, 1)} ${link('Merchant')}: stock and prices per floor</li>
<li>${star(1)} ${link('Blessings')}: every level-up perk</li>
<li>${link('Affixes')} and ${link('Rarity')} of weapons</li></ul></div></div>
<div class="portal"><h2>Did you know...</h2><div class="body"><p>...that ${fact.charAt(0).toLowerCase() + fact.slice(1)}</p>
<p>Latest: the Tapfighter Wiki launched. See ${link('Update_history', 'Update history')}.</p></div></div>
</div>`;
  }, [], 'home');

  // ---------- Getting started ----------
  page('Getting_started', 'Getting started', () => `
<p class="hatnote">This guide covers your first run. For the full mechanics see ${link('Combat')} and ${link('Exploration')}.</p>
${toc(['Your hero', 'Moving around', 'Your first fight', 'Defending', 'Between fights', 'Dying'])}
${h2('Your hero')}<p>You play ${link('Sir_Rattlebone', 'Sir Rattlebone')}, a skeleton knight raised by the ${mlink('lich')}. You start with <b>50 HP</b>, a ${wlink('sword')}, a ${wlink('dagger')} and <b>2</b> ${link('Life_Bottle', 'Life Bottles')}.</p>
${h2('Moving around')}<p>Tap any tile you have seen to walk there; the hero pathfinds around walls. Each step is one <b>turn</b>, and monsters move after you do. Tap chests, fountains, altars and the merchant to walk up and use them. Find the ${link('Stairs')} to go down a floor.</p>
${h2('Your first fight')}<p>When a monster reaches you (or you walk into it), a battle starts. Battles are played with <b>two thumbs at once</b>: you and the monster attack at the same time.</p>
<p>Your <b>right thumb</b> attacks: ${chip('strike', 'strike')} targets appear on the monster (right half of the screen) with a ring shrinking around each one. <b>Tap each target at the moment the ring meets its centre.</b> Perfect taps deal 150% damage, and consecutive hits build a combo.</p>
${h2('Defending')}<p>Your <b>left thumb</b> defends: whenever the monster attacks, marks appear around your hero on the left half:</p>
<ul><li>${chip('guard', 'Shield')}: tap on time to <b>parry</b> (no damage, plus a counter-attack) or <b>block</b> (60% less damage).</li>
<li>${chip('orb', 'Orb')}: a projectile. Tap it before it hits you.</li>
<li>${chip('feint', 'Skull')}: a feint. <b>Don't tap it!</b></li>
<li>${chip('rune', 'Rune')}: a curse glyph. <b>Drag</b> your finger (or mouse) along it, starting at the white dot, before the countdown runs out.</li></ul>
<p>Some monsters (and every boss, once) challenge you to a ${link('Combat', 'rhythm duel')} instead: notes fall down four lanes, and you tap each lane as its note reaches the line.</p>
${h2('Between fights')}<p>Winning gives ${link('Experience', 'experience')} and ${link('Coins', 'coins')}. Each level-up lets you choose one of three ${link('Blessings')}. Drink ${link('Life_Bottle', 'Life Bottles')} from the bottom bar, swap weapons, and spend coins at the ${link('Merchant')} on floor 3.</p>
${h2('Dying')}<p>Death is permanent: the run ends and you start again from floor 1. The game autosaves, so you can close the tab and continue later. Your best floor is recorded on the title screen.</p>
${guideNav()}`, ['Guides'], 'tutorial beginner new');

  // ---------- Combat ----------
  page('Combat', 'Combat', () => `
${toc(['Overview', 'Tempo', 'Striking', 'Defending', 'Runes', 'Rhythm duels', 'Combo', 'The bottom bar', 'Winning and fleeing'])}
${h2('Overview')}<p>Combat in Tapfighter is a two-thumbed rhythm game. Both sides fight <b>at the same time</b>: your strikes stream onto the monster on the <b>right</b> half of the screen while its attacks land around your hero on the <b>left</b> half. A faint dotted line splits the two.</p>
<ul><li>You attack in <b>volleys</b>: one weapon's worth of strikes, then a ${HERO_REST}ms breather, then the next volley.</li>
<li>The monster attacks in <b>patterns</b>: a wind-up (red <b>!</b>), its marks, then a ${FOE_REST}ms rest before the next one.</li>
<li><b>Runes</b> are solo moments: while one is on screen neither side starts anything new, and a rune attack waits until your current volley is done.</li></ul>
${h2('Tempo')}<p>Everything speeds up as you go deeper. Ring times, gaps between strikes and the rests between volleys and attacks are all divided by the floor's <b>tempo</b>. Timing windows do <b>not</b> shrink, but you get less warning.</p>
${table(['Floor', 1, 3, 5, 8, 10, 12, 15, 17], [['Tempo', ...[1, 3, 5, 8, 10, 12, 15, 17].map(d => '×' + tempoAt(d).toFixed(2))]], { sortable: false })}
<p>Tempo is capped at ×1.5. Rune trace windows are not affected by tempo.</p>
${h2('Striking')}<p>Your equipped weapon decides how many <b>strike targets</b> appear per volley (its <i>strikes</i>), how long each ring takes to close (<i>ring time</i>) and the spacing between them (<i>gap</i>). Tap a target as its ring closes:</p>
${table(['Result', 'Condition', 'Effect'], [
    ['<b class="good">PERFECT</b>', 'within the weapon\'s perfect window', '150% damage, +1 combo'],
    ['<b>GOOD</b>', 'within the good window', '100% damage, +1 combo'],
    ['<b class="bad">EARLY</b>', 'tapped before the good window opens', 'no damage, combo reset'],
    ['<b class="bad">MISS</b>', 'ring closed and the window passed without a tap', 'no damage, combo reset'],
    ['<b class="bad">WHIFF</b>', 'tapped empty space on the strike (right) half while targets are active', 'combo reset'],
  ], { sortable: false })}
<p>About <b>25%</b> of targets are <b>critical</b> spots (shown with a star, placed on the monster's head) that deal <b>+40%</b> damage. The ${wlink('staff')}'s targets drift while the ring closes.</p>
${h2('Defending')}<p>The monster winds up (a red <b>!</b> appears) and then sends one of its attacks onto the left half of the screen. Each attack is a pattern of marks:</p>
${table(['Mark', 'What to do', 'Perfect', 'Good', 'Missed'], [
    [chip('guard', 'Shield'), 'Tap as the ring closes', 'PARRY: no damage, counter-attack for 60% of your weapon damage (ignores armour)', 'BLOCK: take 40% damage', 'Full damage, combo reset'],
    [chip('orb', 'Orb'), 'Tap the orb at any time while it flies', 'SMASH: no damage, +1 combo', '(no timing)', 'Full damage'],
    [chip('feint', 'Skull'), '<b>Do not tap</b>', '', '', 'Tapping it: 60% damage and combo reset'],
    [chip('rune', 'Rune'), '<b>Drag</b> to trace the glyph before the countdown ends', 'PERFECT DISPEL: backlash for 90% of the curse', 'DISPELLED: backlash for 60% of the curse (ignores armour)', 'CURSED: full damage, combo reset'],
  ], { sortable: false })}
<p>Parry <b>every</b> shield in a single attack and the monster is <b>staggered</b>: your next volley gets <b>+1 strike</b>. See ${link('Status_effects', 'Status effects')}.</p>
${h2('Runes')}<p>Runes are the fourth combat skill: instead of tapping, you <b>draw</b>. A rune appears as a large glowing glyph in the middle of the arena with a ring of countdown dots around it. Press anywhere that is not another mark and drag along the glyph in one stroke. The white dot and arrow show where to start; either direction works, and closed glyphs (Triangle, Hourglass) can start at any corner. Size and position don't need to be exact, only the shape.</p>
<p>A sloppy trace <b>FIZZLES</b>, which costs nothing: try again until the countdown ends. Taps never count as a trace, so you can still smash orbs that fly in while you draw.</p>
<p>${Object.values(RUNES).map(r => `<span class="rune-glyph"><svg viewBox="-2 -2 14 14" width="44" height="44" aria-hidden="true"><polyline points="${r.pts.map(([x, y]) => `${(x * 10).toFixed(1)},${(y * 10).toFixed(1)}`).join(' ')}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${(r.pts[0][0] * 10).toFixed(1)}" cy="${(r.pts[0][1] * 10).toFixed(1)}" r="1.2" fill="currentColor"/></svg>${r.name}</span>`).join('')}</p>
<ul><li><b>Curses</b> (pink) are enemy attacks. You get <b>${RUNE_TIME / 1000}s</b> to trace them (15% less against an enraged boss). Dispelling one bounces part of the curse back at the caster, ignoring armour.</li>
<li><b>Sigils</b> (gold) are yours. Land <b>every</b> strike in a volley (a <b>FLAWLESS</b> volley) and a random sigil appears for <b>${SIGIL_TIME / 1000}s</b> once the monster's current attack is over (at most once every 8 seconds). Tracing it fires a blast for 125% of your weapon damage (×1.5 if perfect), boosted by combo and ignoring armour. Letting it fade costs nothing.</li>
<li>The ${link('Blessings', 'Rune Lore')} blessing makes runes last 30% longer and hit 50% harder.</li></ul>
${h2('Rhythm duels')}<p>Some monsters fight with music. ${mlink('bard')}s and ${mlink('banshee')}s challenge you to a <b>rhythm duel</b> for the whole battle, and every boss breaks into an <b>encore</b> (a single song) the first time it drops below half health.</p>
<ul><li>The screen splits into <b>four lanes</b>. Notes fall down them to a line near the bottom: tap anywhere in a lane as its note crosses the line. The two left lanes suit your left thumb and the two right lanes your right.</li>
<li><b>Chords</b> are two notes joined by a bar, always one on each side: hit them with both thumbs together.</li>
<li>A hit deals <b>20%</b> of your weapon damage (<b>×1.5</b> if Perfect), boosted by combo and <b>ignoring armour</b>. Each note also plays its pitch, so a clean run plays the song.</li>
<li>A missed note hurts you for 25% of the monster's base damage and resets your combo. Tapping an empty lane costs nothing.</li>
<li>Windows: <b>±${RHYTHM_PERFECT}ms</b> perfect and <b>±${RHYTHM_GOOD}ms</b> good (Steady Hand and Keen Eye widen them by 10ms and 15ms per stack).</li>
<li>Duel songs repeat until someone falls, each verse 5% faster and denser. Songs also get faster with the floor's tempo.</li></ul>
${h2('Combo')}<p>Every successful strike, parry, orb smash, rune and rhythm note adds 1 to your combo. Each point adds 6% damage to strikes (up to +100% at 17 combo). Misses, whiffs, feint taps and unblocked hits reset it. The ${link('Blessings', 'Combo Master')} blessing increases the bonus.</p>
${h2('The bottom bar')}<ul>
<li><b>Weapon slots</b>: swapping throws away the rest of your current volley; the next one starts with the new weapon after a quarter of a second.</li>
<li><b>${link('Life_Bottle', 'Life Bottle')}</b>: heals 40% of max HP. You can drink at any time (one bottle per second).</li>
<li><b>RUN</b>: 55% chance to escape. On failure you lose your current volley and the monster attacks immediately. You cannot flee from bosses. A monster you escape from is dazed for 3 turns on the map.</li></ul>
${h2('Winning and fleeing')}<p>Defeated monsters drop ${link('Coins', 'coins')} and experience, sometimes a ${link('Life_Bottle', 'Life Bottle')} (15%) or a weapon (10%). See each monster's page for exact drops.</p>
${guideNav()}`, ['Guides', 'Mechanics'], 'fight battle parry');

  // ---------- Timing windows ----------
  page('Timing_windows', 'Timing windows', () => `
<p>All windows are measured from the moment the ring touches the centre of its target. A window of ±85ms means a tap up to 85ms early or late counts. Taps are timed to the frame using the event timestamp.</p>
${h2('Weapons')}
${table(['Weapon', 'Ring time', 'Strikes', 'Gap', 'Perfect', 'Good'], WORDER.map(k => {
    const w = WEAPONS[k];
    return [`${wicon(k, 1)} ${wlink(k)}`, `${w.lead}ms`, w.strikes, w.gap ? `${w.gap}ms` : '-', `±${w.perfect}ms`, `±${w.good}ms`];
  }))}
${h2('Defending')}
<p>Shield windows are the same for every monster: <b>±95ms</b> perfect (parry) and <b>±190ms</b> good (block). Monsters vary the <b>ring time</b> instead:</p>
${table(['Monster', 'Fastest ring', 'Slowest ring'], [...ORDER, ...BOSSES].map(t => {
    const l = ENEMIES[t].attacks.map(a => a.lead);
    if (!l.length) return [`${micon(t, 1)} ${mlink(t)}`, 'Rhythm duel', '-'];
    return [`${micon(t, 1)} ${mlink(t)}`, `${Math.min(...l)}ms`, `${Math.max(...l)}ms`];
  }))}
<p>These are floor-1 values: deeper floors divide every ring time by the floor's ${link('Combat', 'tempo')}. Bosses below half HP use rings <b>15% shorter</b> on top of that.</p>
${h2('Widening windows')}
${table(['Source', 'Perfect', 'Good', 'Applies to'], [
    [link('Blessings', 'Steady Hand') + ' (per stack)', '+25ms', '-', 'Strikes and shields'],
    [link('Blessings', 'Keen Eye') + ' (per stack)', '-', '+35ms', 'Strikes and shields'],
    [link('Affixes', 'Keen') + ' affix', '+30ms', '+40ms', 'That weapon\'s strikes'],
  ], { sortable: false })}
${guideNav()}`, ['Guides', 'Mechanics'], 'ms window perfect good');

  // ---------- Damage formula ----------
  page('Damage_formula', 'Damage formula', () => `
${h2('Your strikes')}
<code class="formula">damage = weapon damage × grade × crit × combo × boss bonus − armour   (minimum 1, rounded)

grade      = 1.5 for Perfect, 1.0 for Good
crit       = 1.4 on a starred target
combo      = 1 + min(1, combo × 0.06 × (1 + 0.5 × Combo Master stacks))
boss bonus = 1.5 with the Blessed affix (bosses only)
armour     = monster armour, ignored by Spear, Crossbow and Piercing weapons</code>
${h2('Weapon damage')}
<code class="formula">weapon damage = round(base × (1 + 0.15 × (level − 1)) × affix multipliers × (1 + 0.2 × Brutality stacks))</code>
${h2('Parry counter')}
<code class="formula">counter = round(equipped weapon damage × 0.6 × (2 with Riposte))   (ignores armour)</code>
${h2('Damage you take')}
<code class="formula">hit     = round(monster base damage × attack multiplier)
blocked = round(hit × (1 − min(0.9, 0.6 + 0.15 × Iron Guard stacks)))
feint   = round(hit × 0.6)</code>
${h2('Monster scaling')}
<code class="formula">HP     = round(base HP × (1 + 0.20 × (floor − 1)))
damage = round(base dmg × (1 + 0.11 × (floor − 1)))
armour = base armour + floor(floor / 6)
XP     = round(base XP × (1 + 0.15 × (floor − 1)))
coins  = round(random(base range) × (1 + 0.10 × (floor − 1)) × (1 + 0.4 × Greed stacks))</code>
${h2('Healing')}
<code class="formula">Life Bottle = round(max HP × 0.4 × (1 + 0.5 × Alchemy stacks))
Fountain    = round(max HP × 0.5)
Necromancy  = round(max HP × 0.12 × stacks) after each victory
Vampiric    = round(damage dealt × 0.15) per strike</code>
${guideNav()}`, ['Guides', 'Mechanics'], 'formula math armour');

  // ---------- Status effects ----------
  page('Status_effects', 'Status effects', () => `
${table(['Effect', 'Source', 'What it does'], [
    ['<b>Burn</b>', `${wlink('staff')}, ${link('Affixes', 'Flaming')} affix`, `Each hit adds stacks. Every ${DOT_TICK / 1000}s the monster takes 2 damage per stack, then stacks are halved.`],
    ['<b>Bleed</b>', wlink('axe'), `Each hit adds 2 stacks. Every ${DOT_TICK / 1000}s the monster takes 2 damage per stack, then loses 1 stack.`],
    ['<b>Stun</b>', `${wlink('club')} (35%), ${wlink('hammer')} (100%) on Perfect hits`, 'The monster skips its next attack entirely. Cannot be re-applied while already stunned.'],
    ['<b>Stagger</b>', 'Parrying every shield in one attack', 'Your next volley gets +1 strike.'],
    ['<b>Enrage</b>', 'Bosses below 50% HP', 'Their rings and gaps become 15% shorter.'],
    ['<b>Dazed</b>', 'Fleeing from a monster', 'On the map the monster cannot move or attack for 3 turns.'],
    ['<b>Asleep</b>', 'Monsters at the start of a floor', 'Wanders randomly (20% per turn) until it sees you within 6 tiles.'],
  ], { sortable: false })}
${guideNav()}`, ['Guides', 'Mechanics'], 'burn bleed stun');

  // ---------- Exploration ----------
  page('Exploration', 'Exploration', () => {
    const map = minimap(THEMES[0], 4, 7331);
    return `
<div class="figure right">${map}<div>A generated Boneyard floor. ${legend()}</div></div>
${toc(['Autoexplore', 'Turns', 'Sight', 'Monster behaviour', 'What is on a floor'])}
${h2('Autoexplore')}<p>Tap <b>AUTO</b> in the bottom bar (or press X) and Sir Rattlebone walks himself to the nearest unexplored area, picking up coins and Life Bottles and opening chests on the way. He drinks from a ${link('Fountain')} only when below 60% HP. Autoexplore stops when a new monster comes into view, when a battle starts, or when you tap anywhere. Once the floor is fully explored he walks to the ${link('Stairs')} and asks whether to descend.</p>
${h2('Turns')}<p>The dungeon is turn-based. Every step you take is one turn, after which every monster acts. Diagonal steps are allowed but cannot cut around wall corners. Standing still does not pass time.</p>
${h2('Sight')}<p>You see up to <b>7 tiles</b> in a circle, blocked by walls. Tiles you have seen stay on the map (darkened) once out of sight. Monsters are only shown while you can see them.</p>
${h2('Monster behaviour')}<ul>
<li>Monsters start <b>asleep</b> (a floating Z). A sleeping monster wanders randomly 20% of turns.</li>
<li>A monster wakes (red <b>!</b>) when it is on a tile you can see and within 6 tiles of you. It then hunts you every turn.</li>
<li>${mlink('zombie')}s move every other turn. ${mlink('bat')}s and ${mlink('ghoul')}s move twice per turn. Bosses never move.</li>
<li>Battle starts when an awake monster ends its move next to you (including diagonally), or when you walk into any monster.</li></ul>
${h2('What is on a floor')}<p>Floors are 40×40 tiles of rooms joined by corridors, guaranteed to be fully connected.</p>
${table(['Feature', 'Amount per floor'], [
    ['Rooms', '6 + floor/2 (max 11). Boss floors: 6, including a 9×9 arena'],
    ['Monsters', '4 + 0.7 × floor (max 14). Boss floors: 3 + floor/5, plus the boss'],
    [link('Chest', 'Chests'), '1-3 (15% are Mimics from floor 3)'],
    [link('Life_Bottle', 'Life Bottles'), '0-2'],
    [link('Coins', 'Coin piles'), '2-4, worth 3-8 + 2 × floor each'],
    ['Weapon on the floor', '30% chance'],
    [link('Fountain'), '35% chance'],
    [link('Bone_Altar', 'Bone Altar'), '30% chance (from floor 2)'],
    [link('Merchant'), 'Always on floors 3, 8, 13; 20% chance on other non-boss floors after floor 3'],
  ], { sortable: false })}
${guideNav()}`;
  }, ['Guides', 'Mechanics'], 'map turns sight');

  // ---------- Strategy ----------
  page('Strategy_guide', 'Strategy guide', () => `
${toc(['General tips', 'Floors 1-5', 'Floors 6-10', 'Floors 11-15', 'Choosing blessings'])}
${h2('General tips')}<ul>
<li><b>Parrying is better than blocking, and blocking is better than panicking.</b> A late but in-window tap still blocks 60% of the damage.</li>
<li><b>Keep your thumbs off skulls.</b> Feints are designed to bait reflex taps.</li>
<li><b>Armour is subtracted from every hit.</b> Against armoured monsters use few, big hits or a piercing weapon, not the ${wlink('dagger')}.</li>
<li><b>Watch the left half first.</b> A missed strike only costs damage; a missed shield costs health. When it gets busy, let a strike go rather than a parry.</li>
<li><b>Swap between volleys.</b> Swapping throws away whatever is left of your current volley.</li>
<li><b>Use the map.</b> Monsters wake within 6 tiles of sight. Slow ${mlink('zombie')}s can simply be walked away from.</li></ul>
${h2('Floors 1-5')}<p>Learn timing on ${mlink('zombie')}s and ${mlink('skeleton')}s. Explore fully for coins and Life Bottles; the ${link('Merchant')} on floor 3 is your chance to stock up before the ${mlink('pumpkinKing')}. Aim to reach floor 5 at level 4-5 with 3+ bottles.</p>
${h2('Floors 6-10')}<p>The ${link('Crypts')} bring fast ${mlink('ghoul')}s and spectral ${mlink('wraith')}s (from floor 7). Find a piercing weapon before floor 10: the ${mlink('colossus')} has the highest armour in the game.</p>
${h2('Floors 11-15')}<p>${mlink('gargoyle')}s and ${mlink('witch')}es test armour handling and orb reflexes. ${link('Fountain', 'Fountains')} and Bone Altars become more valuable. Save bottles for ${mlink('lich')}.</p>
${h2('Choosing blessings')}<p>Early on, <b>Bone Plating</b> and <b>Iron Guard</b> keep runs alive. <b>Steady Hand</b> and <b>Keen Eye</b> help every single tap for the rest of the run. <b>Riposte</b> is strong if you parry well. <b>Undying</b> is a second life. See ${link('Blessings')}.</p>
${guideNav()}`, ['Guides'], 'tips help');

  // ---------- Bosses ----------
  page('Bosses', 'Bosses', () => `
<p>A boss guards the stairs on every fifth floor. Bosses never move, cannot be fled from, use a <b>fixed attack rotation</b>, and <b>enrage</b> below 50% HP (15% faster). The stairs down appear where the boss falls. Every boss drops a guaranteed Epic or Legendary weapon and a Life Bottle.</p>
${table(['', 'Boss', 'Floor', 'HP', 'Armour', 'Base dmg', 'Rotation'], BOSSES.map(t => {
    const f = (THEMES.findIndex(th => th.boss === t) + 1) * 5;
    const s = scaleEnemy(t, f);
    return [{ html: micon(t, 2), cls: 'icon-cell' }, mlink(t), f, s.hp, s.armor, s.dmg, ENEMIES[t].attacks.map(a => a.name).join(' &rarr; ')];
  }))}
<p>Each boss page has a full attack breakdown and strategy:</p><ul>${BOSSES.map(t => `<li>${mlink(t)}</li>`).join('')}</ul>
${bestiaryNav()}`, ['Bestiary'], 'boss pumpkin king colossus lich');

  // ---------- Bestiary ----------
  page('Bestiary', 'Bestiary', () => `
<p>Every monster in Tapfighter, with stats on the first floor where it can appear. Click a column header to sort.</p>
${table(['', 'Monster', 'First floor', 'HP', 'Damage', 'Armour', 'XP', 'Coins', 'Movement'], [...ORDER, ...BOSSES].map(t => {
    const d = ENEMIES[t];
    const f = d.boss ? (THEMES.findIndex(th => th.boss === t) + 1) * 5 : t === 'mimic' ? 3 : Math.min(...THEMES.flatMap((th, i) => th.enemies.filter(e => e[0] === t).map(e => Math.max(i * 5 + 1, e[1]))));
    const s = scaleEnemy(t, f);
    return [{ html: micon(t, 2), cls: 'icon-cell' }, mlink(t), f, s.hp, s.dmg, s.armor, xpAt(t, f), goldAt(t, f).join('-'),
      d.boss ? 'Stationary' : d.slow ? 'Slow' : d.fast ? 'Fast' : 'Normal'];
  }))}
${bestiaryNav()}`, [], 'monsters enemies');

  // ---------- Weapons ----------
  page('Weapons', 'Weapons', () => `
<p>${link('Sir_Rattlebone', 'Sir Rattlebone')} carries up to <b>three</b> weapons and can swap between them at any time. Weapons differ in how many strikes they give per turn and how their rings are timed, so each has its own rhythm. Stats below are for a level 1 Common weapon.</p>
${table(['', 'Weapon', 'Dmg', 'Strikes', 'Turn dmg', 'Ring', 'Perfect', 'Good', 'Floor', 'Special'], WORDER.map(k => {
    const w = WEAPONS[k], s = stat(k);
    const sp = [w.pierce && 'Pierce', w.stun && 'Stun', w.bleed && 'Bleed', w.burn && 'Burn', w.heal && 'Heal', w.drift && 'Drift'].filter(Boolean).join(', ');
    return [{ html: wicon(k, 2), cls: 'icon-cell' }, wlink(k), s.dmg, s.strikes, s.dmg * s.strikes, `${w.lead}ms`, `±${w.perfect}`, `±${w.good}`, firstAvail(k), sp || '-'];
  }))}
<p>Weapons can be found lying on the floor, in ${link('Chest', 'chests')}, as monster drops, and bought from the ${link('Merchant')}. A found weapon's level is usually the current floor ±1. See ${link('Rarity')} and ${link('Affixes')}. When your bag is full, picking up a weapon drops the one it replaces on the floor.</p>
${weaponNav()}`, [], 'weapon list');

  // ---------- Affixes ----------
  page('Affixes', 'Affixes', () => `
<p>Rare weapons roll one affix, and Epic and Legendary weapons roll two. The first affix becomes part of the weapon's name (e.g. "Flaming Broadsword").</p>
${table(['Affix', 'Effect'], Object.values(AFFIXES).map(a => [`<b>${a.name}</b>`, a.desc]))}
<p><b>Piercing</b> never rolls on weapons that already pierce (${wlink('spear')}, ${wlink('crossbow')}).</p>${weaponNav()}`, ['Weapons'], 'flaming vampiric keen brutal swift');

  // ---------- Rarity ----------
  page('Rarity', 'Rarity', () => `
${table(['Rarity', 'Affixes', 'Bonus'], RARITY.map((r, i) => [`<span class="r${i}">${r.name}</span>`, Math.min(2, i), i === 3 ? '+2 weapon levels' : '-']), { sortable: false })}
${h2('Drop chances by floor')}<p>Chances for weapons found on the floor and from monsters. Chests have a 50% chance of a guaranteed Rare/Epic roll; the ${link('Merchant')} sells only Rare (60%) and Epic (40%) weapons; bosses drop Epic (65%) or Legendary (35%).</p>
${table(['Floor', 'Common', 'Rare', 'Epic', 'Legendary'], [1, 3, 5, 8, 10, 12, 15, 20].map(d => [d, ...rarityOdds(d)]))}
${weaponNav()}`, ['Weapons'], 'legendary epic rare common');

  // ---------- Blessings ----------
  const bnotes = {
    vigor: 'Stacks.', steady: 'Stacks.', keen: 'Stacks.', brutal: 'Stacks additively (+20% each).', riposte: 'Extra copies have no effect.',
    guard: 'Max 2 stacks (block 60% → 75% → 90%).', alchemy: 'Stacks.', greed: 'Stacks.', necro: 'Stacks.', combo: 'Stacks.',
    undying: 'Each stack is one revive at 30% HP.', thorns: 'Stacks; also triggers on blocked hits.', leech: 'Stacks.', bottle: 'Instant.', runic: 'Stacks.',
  };
  page('Blessings', 'Blessings', () => `
<p>Each time you <b>level up</b> you gain +4 max HP and choose one of <b>three random blessings</b>. Blessings also come from ${link('Bone_Altar', 'Bone Altars')} and ${link('Blessing_Scroll', 'Blessing Scrolls')}. All blessings last for the rest of the run.</p>
${table(['', 'Blessing', 'Effect', 'Stacking'], BLESSINGS.map(b => [{ html: star(2), cls: 'icon-cell' }, `<b>${b.name}</b>`, b.desc, bnotes[b.id] || '']))}
${guideNav()}`, ['Items'], 'perk level up');

  // ---------- Items ----------
  page('Items', 'Items', () => table(['', 'Item', 'Effect', 'Source'], [
    [{ html: potion(3), cls: 'icon-cell' }, link('Life_Bottle', 'Life Bottle'), 'Heals 40% max HP', 'Floors, chests, drops, merchant'],
    [{ html: img(SPR.potion, 3), cls: 'icon-cell' }, link('Bone_Elixir', 'Bone Elixir'), '+10 max HP permanently', 'Merchant'],
    [{ html: star(3), cls: 'icon-cell' }, link('Blessing_Scroll', 'Blessing Scroll'), 'Choose a blessing', 'Merchant'],
    [{ html: img(SPR.coins, 3), cls: 'icon-cell' }, link('Coins'), 'Currency', 'Everywhere'],
  ]) + `<p>Weapons have their own page: ${link('Weapons')}.</p>`, [], 'items');
  const itemBox = (title, image, rows) => infobox({ title, image, sections: [{ head: 'Item', rows }] });
  page('Life_Bottle', 'Life Bottle', () => itemBox('Life Bottle', potion(6), [['Effect', 'Heal 40% of max HP'], ['Price', '22 + 3 × floor'], ['Usable', 'Map and battle']]) +
    `<p>The <b>Life Bottle</b> is the main healing item. You start each run with 2. Tap the bottle in the bottom bar to drink one.</p>
<ul><li>Heals 40% of max HP (+50% per ${link('Blessings', 'Alchemy')} stack). It cannot be drunk at full HP.</li>
<li>In battle you can drink at any time, at most one bottle per second.</li>
<li>Found lying on floors (0-2 per floor), in 25% of chests, dropped by 15% of monsters and every boss, and sold by the ${link('Merchant')}.</li>
<li><b>Bottle Bearer</b> grants 2 immediately.</li></ul>`, ['Items'], 'potion heal');
  page('Bone_Elixir', 'Bone Elixir', () => itemBox('Bone Elixir', img(SPR.potion, 6), [['Effect', '+10 max HP and +10 HP'], ['Price', '70 + 6 × floor']]) +
    `<p>A permanent upgrade sold only by the ${link('Merchant')}. Each merchant stocks one.</p>`, ['Items']);
  page('Blessing_Scroll', 'Blessing Scroll', () => itemBox('Blessing Scroll', star(6), [['Effect', 'Choose 1 of 3 blessings'], ['Price', '120 + 10 × floor']]) +
    `<p>Lets you pick a ${link('Blessings', 'blessing')} without levelling up. Each merchant stocks one.</p>`, ['Items']);
  page('Coins', 'Coins', () => itemBox('Coins', img(SPR.coins, 6), [['Use', 'Buying from the Merchant']]) +
    `<p>Coins are the only currency, spent at the ${link('Merchant')}. Sources:</p>
${table(['Source', 'Amount'], [['Coin pile on the floor', '3-8 + 2 × floor'], ['Chest (40%)', '12-25 + 4 × floor'], ['Monster', 'See each monster page'], [mlink('mimic'), '25-45 (scaled by floor)'], ['Bosses', '60-220 (scaled by floor)']], { sortable: false })}
<p>The ${link('Blessings', 'Greed')} blessing adds 40% per stack to every source.</p>`, ['Items'], 'gold gp money');

  // ---------- Merchant ----------
  page('Merchant', 'Merchant', () => {
    const rows = [1, 3, 5, 8, 10, 13, 15].map(d => [d, 22 + d * 3, `${45 + d * 9 + 30} / ${45 + d * 9 + 60}`, 70 + d * 6, 120 + d * 10]);
    return infobox({ title: 'Merchant', image: img(SPR.merchant, 5), sections: [{ head: 'Info', rows: [['Floors', '3, 8, 13 (guaranteed)<br>20% on other non-boss floors after 3'], ['Quote', '"Bones and baubles, cheap!"']] }] }) +
      `<p>The <b>Merchant</b> is a hooded trader who sets up shop in the dungeon. Tap them to browse. Each item can be bought once; stock is generated the first time you visit.</p>
${h2('Stock')}${table(['', 'Item', 'Qty', 'Price', 'Notes'], [
        [{ html: potion(2), cls: 'icon-cell' }, link('Life_Bottle', 'Life Bottle'), 2, '22 + 3 × floor', 'Heals 40% max HP'],
        [{ html: wicon('broad', 2), cls: 'icon-cell' }, 'Weapon', 1, '45 + 9 × floor + 30 × rarity', 'Rare (60%) or Epic (40%), level = floor + 1 ± 1'],
        [{ html: img(SPR.potion, 2), cls: 'icon-cell' }, link('Bone_Elixir', 'Bone Elixir'), 1, '70 + 6 × floor', '+10 max HP'],
        [{ html: star(2), cls: 'icon-cell' }, link('Blessing_Scroll', 'Blessing Scroll'), 1, '120 + 10 × floor', 'Choose a blessing'],
      ], { sortable: false })}
${h2('Prices by floor')}${table(['Floor', 'Life Bottle', 'Weapon (Rare / Epic)', 'Bone Elixir', 'Blessing Scroll'], rows)}
${note('<b>Tip:</b> the floor 3 merchant is the last guaranteed shop before the Pumpkin King. Two Life Bottles there cost 62 coins.')}`;
  }, ['Objects'], 'shop buy store prices');

  // ---------- Objects ----------
  page('Objects', 'Objects', () => table(['', 'Object', 'Effect'], [
    [{ html: img(SPR.chest, 2), cls: 'icon-cell' }, link('Chest'), 'Coins, a Life Bottle or a weapon. Sometimes a Mimic.'],
    [{ html: img(SPR.fountain, 2), cls: 'icon-cell' }, link('Fountain'), 'Heals 50% max HP once.'],
    [{ html: img(SPR.altar, 2), cls: 'icon-cell' }, link('Bone_Altar', 'Bone Altar'), 'Trade max HP for a blessing.'],
    [{ html: img(SPR.merchant, 2), cls: 'icon-cell' }, link('Merchant'), 'Sells items.'],
    [{ html: img(getTiles(THEMES[0]).stairs, 2), cls: 'icon-cell' }, link('Stairs'), 'Leads to the next floor.'],
  ]), [], 'objects');
  page('Chest', 'Chest', () => infobox({ title: 'Chest', image: img(SPR.chest, 5) + ' ' + img(SPR.chestOpen, 5), sections: [{ head: 'Info', rows: [['Per floor', '1-3'], ['Mimic chance', '15% (floor 3+)']] }] }) +
    `<p>Tap a chest to walk to it and open it.</p>${table(['Contents', 'Chance'], [['Coins (12-25 + 4 × floor)', '40%'], [link('Life_Bottle', 'Life Bottle'), '25%'], ['Weapon (50% chance to be at least Rare)', '35%']], { sortable: false })}
${note(`From floor 3, 15% of chests are ${mlink('mimic')}s. There is no visual tell.`, true)}`, ['Objects']);
  page('Fountain', 'Fountain', () => infobox({ title: 'Fountain', image: img(SPR.fountain, 5), sections: [{ head: 'Info', rows: [['Chance', '35% per floor'], ['Effect', 'Heal 50% max HP'], ['Uses', '1']] }] }) +
    `<p>A fountain of restorative water. Use it once to heal half your max HP. The water sparkles while it is unused. Best saved until you are actually hurt, ideally just before taking the stairs to a boss floor.</p>`, ['Objects']);
  page('Bone_Altar', 'Bone Altar', () => infobox({ title: 'Bone Altar', image: img(SPR.altar, 5), sections: [{ head: 'Info', rows: [['Chance', '30% per floor (floor 2+)'], ['Cost', '15% of max HP (min 5)'], ['Reward', 'Choose 1 of 3 blessings']] }] }) +
    `<p>A grim altar that permanently takes <b>15% of your max HP</b> in exchange for a ${link('Blessings', 'blessing')}. You cannot offer if it would leave you below 10 max HP. Usually worth it early, when blessings compound for many floors.</p>`, ['Objects']);
  page('Stairs', 'Stairs', () => `<p>${img(getTiles(THEMES[0]).stairs, 4)}</p><p>Each floor has one staircase, placed in the room farthest from where you arrive. Found stairs are marked by a pillar of gold light, and an arrow at the screen edge points to them when they are off screen (tap it to walk there). Step onto them to be asked whether to descend; if you choose to stay, a <b>DESCEND</b> button appears while you stand on them. On boss floors the stairs only appear once the boss is destroyed. You cannot return to a previous floor.</p>`, ['Objects']);

  // ---------- Locations ----------
  const regionPage = (i) => {
    const th = THEMES[i];
    const floors = floorsOfTheme(i);
    const bg = makeBackdrop(th, 320, 180, 104);
    const T = getTiles(th);
    const all = [...new Set(floors.flatMap(f => spawnTable(f).map(([t]) => t)))];
    const spawn = table(['Monster', ...floors.map(f => `Floor ${f}`)], all.map(t => [`${micon(t, 1)} ${mlink(t)}`, ...floors.map(f => {
      const r = spawnTable(f).find(([x]) => x === t);
      return r ? r[1].toFixed(0) + '%' : '-';
    })]));
    return infobox({ title: th.name, image: img(T.floors[0], 3) + img(T.wall, 3), sections: [{ head: 'Info', rows: [['Floors', `${floors[0]}-${floors[4]}`], ['Boss', mlink(th.boss)], ['Endless floors', `${floors[0] + 15}-${floors[4] + 15}, ...`]] }] }) +
      `<p>${({ graveyard: 'The <b>Boneyard</b> is the moonlit cemetery where every run begins. Mossy walls, crooked gravestones and dead trees surround open lawns.', crypt: 'The <b>Crypts</b> are the brick tombs beneath the Boneyard, lined with coffins, urns and pillars and lit by torches.', cathedral: 'The <b>Cursed Cathedral</b> is the Lich\'s seat of power: checkered marble, stone statues and a vast stained-glass rose window.' })[th.id]}</p>
<div class="figure">${img(bg, 2, th.name + ' battle backdrop')}<div>Battle backdrop</div></div>
<div class="figure">${minimap(th, 3, 100 + i)}<div>An example floor. ${legend()}</div></div>
${h2('Monsters')}<p>Share of spawns on each floor:</p>${spawn}
${h2('Boss')}<p>${micon(th.boss, 2)} ${mlink(th.boss)} waits on floor ${floors[4]}.</p>
${navbox('Locations', [['Regions', THEMES.map(t => link(THEME_PAGE[t.id], t.name))], ['See also', [link('Endless_mode', 'Endless mode'), link('Exploration')]]])}`;
  };
  THEMES.forEach((th, i) => page(THEME_PAGE[th.id], th.name, () => regionPage(i), ['Locations'], th.id));
  page('Locations', 'Locations', () => table(['Region', 'Floors', 'Boss'], THEMES.map((th, i) => [link(THEME_PAGE[th.id], th.name), `${i * 5 + 1}-${i * 5 + 5}`, mlink(th.boss)])) +
    `<p>After floor ${FINAL_DEPTH} the regions repeat in ${link('Endless_mode', 'Endless mode')}.</p>`, [], 'regions areas');
  page('Endless_mode', 'Endless mode', () => `<p>After defeating ${mlink('lich')} on floor ${FINAL_DEPTH}, you can <b>retire</b> (ending the run as a win) or <b>go deeper</b>. Deeper floors cycle through the regions again (16-20 Boneyard, 21-25 Crypts, 26-30 Cathedral, ...) with bosses on every fifth floor. Monster scaling never stops: on floor 30 a ${mlink('zombie')} has ${scaleEnemy('zombie', 30).hp} HP.</p>
${table(['Floor', 'Boss', 'HP', 'Armour', 'Base dmg'], [20, 25, 30, 35, 40, 45].map(f => { const t = THEMES[Math.floor((f - 1) / 5) % 3].boss; const s = scaleEnemy(t, f); return [f, mlink(t), s.hp, s.armor, s.dmg]; }))}`, ['Locations'], 'endless infinite');

  // ---------- Experience ----------
  page('Experience', 'Experience', () => {
    let cum = 0;
    const rows = [];
    for (let l = 1; l <= 25; l++) { rows.push([l, cum, xpNeed(l), 50 + 4 * (l - 1)]); cum += xpNeed(l); }
    return `<p>Defeating monsters gives experience (XP). Each level grants <b>+4 max HP</b> (and heals 4) and a choice of ${link('Blessings', 'blessing')}.</p>
<code class="formula">XP to next level = 16 + 12 × level + 2 × level²</code>
${table(['Level', 'Total XP', 'XP to next', 'Base max HP'], rows)}`;
  }, ['Mechanics'], 'xp level');

  // ---------- Sir Rattlebone ----------
  page('Sir_Rattlebone', 'Sir Rattlebone', () => infobox({ title: 'Sir Rattlebone', image: img(SPR.hero, 6), caption: 'The hero, mid-rattle', sections: [{ head: 'Starting stats', rows: [['HP', 50], ['Weapons', `${wlink('sword')}, ${wlink('dagger')}`], ['Life Bottles', 2], ['Weapon slots', 3]] }] }) +
    `<p><b>Sir Rattlebone</b> is the player character: a knight who fell in battle long ago and was accidentally raised by ${mlink('lich')} along with the rest of the realm's dead. Unlike the other skeletons he kept his wits, his armour and one good eye, and he means to put things right.</p>
${h2('Growth')}<p>He gains +4 max HP per level (see ${link('Experience')}), plus permanent upgrades from ${link('Blessings')} and ${link('Bone_Elixir', 'Bone Elixirs')}.</p>`, [], 'player hero character');

  // ---------- Controls ----------
  page('Controls', 'Controls', () => table(['Action', 'Touch', 'Keyboard'], [
    ['Walk', 'Tap a tile', 'Arrow keys / WASD (one step)'],
    ['Use chest, merchant, etc.', 'Tap it', '-'],
    ['Strike', 'Right thumb: tap the ring on the monster', '-'],
    ['Parry / smash', 'Left thumb: tap the mark by your hero', '-'],
    ['Rhythm notes', 'Tap the lane as the note hits the line', '-'],
    ['Trace a rune', 'Drag along the glyph', 'Drag with the mouse'],
    ['Autoexplore', 'AUTO button (tap again or anywhere to stop)', 'X'],
    ['Swap weapon', 'Tap a weapon slot', '1, 2, 3 (in battle)'],
    ['Drink Life Bottle', 'Tap the bottle', 'Q (in battle)'],
    ['Weapon details', 'Tap the equipped weapon (map)', '-'],
    ['Pause menu', 'Menu button', 'Esc'],
  ], { sortable: false }) + `<p>For the best experience on a phone, use your browser's <i>Add to Home Screen</i> to play fullscreen. Two thumbs help with fast patterns like ${mlink('ghoul')} Frenzy.</p>`, ['Guides']);

  // ---------- Update history ----------
  page('Update_history', 'Update history', () => table(['Date', 'Update'], [
    ['20 October 2026', '<b>Two-thumb combat and rhythm duels.</b> Battles are no longer turn-based: you strike with your right thumb while defending with your left, and everything speeds up the deeper you go. New monsters, the <b>Bone Bard</b> and the <b>Banshee</b>, challenge you to four-lane rhythm duels, and every boss breaks into a rhythm encore at half health.'],
    ['20 October 2026', '<b>Runes, autoexplore and stair beacons.</b> Some monsters now cast <b>rune curses</b> you dispel by tracing the glyph, and flawless strike turns earn a <b>sigil</b> to trace for a bonus blast. New blessing: Rune Lore. An <b>AUTO</b> button explores the floor for you, and stairs are now marked with a light pillar, an off-screen pointer and a DESCEND button.'],
    ['20 October 2026', `<b>The Tapfighter Wiki</b> launches, with a WIKI button on the title screen and in the pause menu.`],
    ['20 October 2026', '<b>Tapfighter released.</b> 15 floors across 3 regions, 10 monsters, 3 bosses, 10 weapons, 7 affixes and 14 blessings.'],
  ], { sortable: false }), [], 'changelog patch');

  // Category pages
  const catPage = (name, filter) => page(name, `Category:${name}`.replace('Category:', ''), () => `<p>Pages in category "${name}":</p><ul>${Object.entries(P).filter(([, p]) => p.cats.includes(name)).map(([id, p]) => `<li>${link(id, p.title)}</li>`).join('')}</ul>`);
  catPage('Guides'); catPage('Mechanics');
  return P;
}

// Top-down map of a generated floor, drawn at `s` px per tile.
function minimap(theme, s, seed) {
  const depth = THEMES.indexOf(theme) * 5 + 2;
  const m = generate(depth, seed);
  const c = makeCanvas(MW * s, MH * s);
  const g = c.getContext('2d');
  g.fillStyle = '#0b0714'; g.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = y * MW + x;
    if (m.tiles[i]) g.fillStyle = m.solid[i] ? '#6a5a50' : theme.floor[0];
    else if (m.edge[i]) g.fillStyle = theme.wallTop;
    else continue;
    g.fillRect(x * s, y * s, s, s);
  }
  const col = { enemy: '#e04040', chest: '#f0d050', stairs: '#ffffff', fountain: '#70d0e0', merchant: '#e8822c', altar: '#c070f0', potion: '#ff80a0', gold: '#f0d050', weapon: '#a8b4c0' };
  for (const e of m.ents) { g.fillStyle = col[e.kind] || '#fff'; g.fillRect(e.x * s, e.y * s, s, s); }
  g.fillStyle = '#7ac040'; g.fillRect(m.start[0] * s - 1, m.start[1] * s - 1, s + 2, s + 2);
  return `<img class="sprite" src="${c.toDataURL()}" width="${c.width * (s < 4 ? 2 : 1.5)}" alt="Map of a generated floor">`;
}
function legend() {
  return '<span style="color:#7ac040">&#9632;</span> start <span style="color:#e04040">&#9632;</span> monster <span style="color:#f0d050">&#9632;</span> chest/coins <span style="color:#70d0e0">&#9632;</span> fountain <span style="color:#e8822c">&#9632;</span> merchant <span style="color:#fff">&#9632;</span> stairs';
}
