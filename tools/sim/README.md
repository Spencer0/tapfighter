# Balance simulator

Plays full Tapfighter runs headless in Node (v18+, no dependencies) with a simulated player, using the
game's own modules (`src/`). Use it to see how likely players of a given skill are to beat the game.

```sh
node tools/sim/sim.mjs                                   # 100%, 80% and 50% accuracy, 200 runs each
node tools/sim/sim.mjs --acc 0.9 --runs 500 --seed 3     # other skills / sample sizes
node tools/sim/sim.mjs --set foeDmg=1.2,potionCooldown=3000   # try balance changes without editing code
node tools/sim/sim.mjs --acc 0.8 --only 12345 --verbose  # replay one run floor by floor
node tools/sim/tune.mjs --iters 30 --runs 40             # hill-climb BAL toward target win rates
```

A run takes about 2 s of CPU. Runs are spread over every core and seeded from `(seed, accuracy, index)`,
so the same command always gives the same numbers.

## What the bot does

It plays like a person who knows the game, not like a perfect machine:

- **Exploring**: uses AUTO, then makes the side trips autoexplore won't: picks up weapons worth having,
  shops (weapon upgrade, then bottles up to 4, blessing scroll, elixir), uses fountains when hurt and
  altars when it can spare the HP. It fights whatever comes at it and takes the stairs once the floor is done.
- **Weapons**: keeps the three with the best expected damage per second for its own skill (window sizes,
  armour, pierce, DoTs, healing) and equips the best one for each foe at the start of a fight.
- **Blessings**: picks by a fixed preference that leans defensive for weaker players (Keen Eye, Iron Guard)
  and offensive for strong ones (Riposte, Combo Master).
- **Bottles**: drinks in battle as soon as one would not be wasted and the cooldown is up, using a moment
  when the left thumb is free. Below 25% HP it drinks right away. Out of battle it tops up below 50% HP.

## The skill model

`--acc` is the share of timed taps that land, measured on the Short Sword's ±170ms window. It is made of
two human failure modes:

| | 100% | 80% | 50% |
| --- | --- | --- | --- |
| timing spread (sigma) | 40ms | 50ms | 65ms |
| lapses (input missed outright) | 0% | ~20% | ~49% |

- Timing error is normal with that sigma, and grows up to 1.8x when one thumb has to hit two marks less
  than 200ms apart. So tight windows (crossbow, hammer, parries) land less often, Keen/Steady really help,
  and a "100%" player still lands GOODs instead of PERFECTs some of the time.
- Orbs are tapped after a 330-400ms reaction. Skull feints get tapped by mistake at half the lapse rate.
- Runes: spotted after ~400ms, each trace attempt takes 750ms (100%) to 1050ms (50%) and passes with
  probability = accuracy, retried until the curse lands.
- Rhythm notes use the same timing model with the rhythm windows (left lanes = left thumb).

## Reading the output

```
=== accuracy 80%: 111/200 wins = 55.5% (+/-6.9)
  landed 78.2% of 196049 inputs, perfect 59.3%, runes 4816/5960 traces
  median floor reached 15, median level 15, potions drunk 10.6 in fights + 1.1 outside per run
  lowest HP in a run (share of max): p10 0%  median 9%  p90 26%; damage taken 1282 per run
  damage from: block 42%, guard missed 31%, rhythm miss 16%, orb 6%, ...
  deaths by floor: F6:2 F8:1 F9:2 F10:28 ...
  killers: Gargoyle 30, Bone Colossus (boss) 25, Lich Morthos (boss) 15, ...
```

`+/-` is a 95% confidence interval: use 200+ runs before trusting a few points of difference.

## Balance knobs

`BAL` in `src/data.js` holds the numbers that move difficulty the most (monster damage and HP growth,
shield windows, block strength, bottle heal/cooldown/drop rate, combo cap, perfect bonus, HP per level).
`--set key=value,...` overrides them for a simulation only; edit `BAL` to change the game.
