// Rhythm duels: procedural four-lane songs. Notes fall to a hit line; lanes 0-1 suit the left
// thumb and 2-3 the right, so chords always pair one note from each half.
export const LANES = 4;
export const LANE_COL = ['#ff6050', '#f0d050', '#70d0e0', '#7ac040'];
export const RHYTHM_PERFECT = 60; // ms either side of the beat
export const RHYTHM_GOOD = 135;

const SCALE = [0, 3, 5, 7, 10, 12, 15, 17]; // minor pentatonic over two octaves

// cfg: { bpm, bars, density (0..1 chance of a note on each beat), chords (0..1 chance a beat note is a chord) }
// Returns { notes: [{t, lane, midi}], beat, len } with times in ms from the song start.
export function makeSong(rng, { bpm, bars = 8, density = 0.5, chords = 0, root = 57 }) {
  const beat = 60000 / bpm, step = beat / 2;
  const notes = [];
  let lane = rng.int(0, LANES - 1);
  for (let b = 0; b < bars; b++) {
    for (let i = 0; i < 8; i++) {
      if (b === 0 && i < 4) continue; // one bar count-in: the first half is empty
      const onBeat = i % 2 === 0;
      if (!rng.chance(onBeat ? density : density * 0.4)) continue;
      const t = Math.round((b * 8 + i) * step);
      lane = Math.max(0, Math.min(LANES - 1, lane + rng.pick([-1, 1, -1, 1, 2, -2, 0])));
      notes.push({ t, lane, midi: root + SCALE[(lane * 2 + b) % SCALE.length] });
      if (onBeat && rng.chance(chords)) {
        const other = lane < 2 ? rng.int(2, 3) : rng.int(0, 1);
        notes.push({ t, lane: other, midi: root + SCALE[(other * 2 + b + 2) % SCALE.length] - 12, chord: true });
      }
    }
  }
  return { notes, beat, len: Math.round(bars * 8 * step) };
}
