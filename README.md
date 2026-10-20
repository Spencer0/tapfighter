# Tapfighter: The Boneyard Crawl

A mobile-first, 2.5D pixel-art roguelike where **combat is all about tap timing**.
Guide Sir Rattlebone, a resurrected skeleton knight, through 15 procedurally generated
floors of graveyards, crypts and a cursed cathedral, then slay Lich Morthos.

**Play:** https://spencer0.github.io/tapfighter/ (best on a phone; add it to your home screen for fullscreen)

**Wiki:** https://spencer0.github.io/tapfighter/wiki/ (OSRS-wiki style guide to every monster, boss, weapon, item and formula; also linked from the title screen)

## How to play

**Explore**: tap a tile to walk there, or tap **AUTO** to autoexplore (it stops when a new monster shows up, and heads
for the stairs once the floor is done). Tap chests, fountains, altars and merchants to use them.
Enemies wake when they see you and hunt you down turn by turn. Found stairs glow with a pillar of gold light
(an edge arrow points to them when off screen); step on them to go deeper.

**Fight**: battles alternate between two phases.
- **Strike!** Rings close over targets on the enemy. Tap each target as its ring meets the center.
  *Perfect* hits do 150% damage, ★ targets are critical weak points, and consecutive hits build a combo multiplier.
- **Defend!** The enemy attacks:
  - **Shields** appear around you. Tap them on time to *parry* (no damage plus a counter-attack) or *block* (reduced damage).
    Parry a whole attack to stagger the foe for a bonus strike.
  - **Green orbs** are projectiles. Tap them before they reach you.
  - **Purple skulls** are feints. *Don't* tap them.
  - **Pink runes** are curses. *Drag* along the glyph before its countdown ends to dispel it and bounce damage back.
- **Sigils**: land every strike in a turn and a gold rune appears. Trace it for a bonus blast.

**Bottom bar**: swap between up to 3 weapons (each has its own rhythm), drink Life Bottles, or RUN.

**Weapons** include swords, daggers (5 rapid strikes), axes (bleed), warhammers (one huge stunning blow),
spears and crossbows (pierce armor), hex staffs (drifting targets that burn), and the Chicken Leg (heals on every hit).
Rare, epic and legendary weapons roll affixes like *Flaming*, *Vampiric*, *Keen* and *Swift*.

**Leveling up** offers a choice of 3 blessings (wider timing windows, riposte, thorns, necromancy, cheat death, ...).
Death is permanent, but the run auto-saves so you can close the tab and continue later.

Keyboard (desktop): arrows/WASD to step, `X` to autoexplore, `1` `2` `3` to swap weapons in battle, `Q` to drink, `Esc` for the menu.
Runes are drawn by dragging with the mouse.

## Tech

- Vanilla JavaScript ES modules + Canvas 2D. No build step and no dependencies.
- All art (sprites, isometric tiles, backdrops) is procedural or authored as palette strings in `src/sprites.js`.
- All audio (SFX and the waltz/battle/boss music) is synthesized with WebAudio in `src/audio.js`.
- Renders to a low-res buffer scaled up by an integer factor for crisp pixels on any screen.

| File | What it does |
| --- | --- |
| `src/engine.js` | canvas scaling, main loop, input, scene transitions |
| `src/explore.js` | isometric dungeon scene, FOV, pathfinding, autoexplore, turns, shops and dialogs |
| `src/combat.js` | the tap-timing battle system |
| `src/runes.js` | rune glyphs and the stroke matcher used for tracing them |
| `src/dungeon.js` | procedural floor generation |
| `src/data.js` | weapons, affixes, enemies, bosses, blessings, balance formulas |
| `src/ui.js`, `src/font.js` | pixel UI kit and a 3x5 bitmap font |
| `wiki/` | the wiki. It imports the game's own data and sprites, so its stats and pictures always match the game |

Run locally with any static server, e.g. `npx http-server .`, then open http://localhost:8080.

## Deploy

`.github/workflows/pages.yml` publishes the game and the wiki on every push.
If the site shows a 404, turn Pages on once: **Settings → Pages → Build and deployment → Source: Deploy from a branch → `gh-pages` / `(root)` → Save**.
(Choosing "GitHub Actions" as the source also works.)
