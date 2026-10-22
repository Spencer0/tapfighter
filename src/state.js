// Run creation plus localStorage persistence (save, records).
import { RNG, newSeed } from './rng.js';
import { makeWeapon } from './data.js';

const SAVE_KEY = 'tapfighter.save.v1';
const REC_KEY = 'tapfighter.records.v1';

export function newRun() {
  const seed = newSeed();
  const rng = new RNG(seed);
  return {
    seed, depth: 1, hp: 50, maxHp: 50, level: 1, xp: 0, levelUps: 0, gold: 0, potions: 2,
    weapons: [makeWeapon(rng, 1, 'sword', 0), makeWeapon(rng, 1, 'dagger', 0)], equipped: 0,
    bless: {}, kills: 0, steps: 0, bestCombo: 0, won: false, startedAt: Date.now(),
  };
}

export function saveGame(data) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* storage full or blocked */ }
}
export function loadGame() {
  try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }

export function getRecords() {
  let r = null;
  try { r = JSON.parse(localStorage.getItem(REC_KEY) || 'null'); } catch { /* ignore */ }
  return Object.assign({ bestDepth: 0, bestLevel: 0, runs: 0, wins: 0, battles: 0, kills: 0 }, r || {});
}
export function setRecords(r) { try { localStorage.setItem(REC_KEY, JSON.stringify(r)); } catch { /* ignore */ } }
export function recordRunEnd(run) {
  const r = getRecords();
  r.runs++;
  r.bestDepth = Math.max(r.bestDepth, run.depth);
  r.bestLevel = Math.max(r.bestLevel, run.level);
  r.kills += run.kills;
  if (run.won) r.wins++;
  setRecords(r);
  return r;
}
export function bumpBattles() { const r = getRecords(); r.battles++; setRecords(r); return r.battles; }
